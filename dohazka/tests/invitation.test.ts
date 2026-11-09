import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

// Paměťová „databáze“ se stejnou sémantikou, na které stojí zámek jednorázovosti:
// deleteMany vrací počet skutečně smazaných řádků a transakce se při výjimce vrací celá.
type Inv = { id: string; userId: string; membershipId: string | null; kind: string; expiresAt: Date; createdAt: Date }
const store = vi.hoisted(() => ({
  invitations: new Map<string, unknown>(),
  users: new Map<string, { id: string; email: string; passwordHash: string; passwordSetByOwner?: boolean }>(),
  sessions: new Map<string, { id: string; userId: string }>(),
  memberships: new Map<string, { id: string; org: { name: string } }>(),
  failUserUpdate: false,
}))

function matches(inv: Inv, where: { id?: string; userId?: string; expiresAt?: { gt: Date } }) {
  if (where.id !== undefined && inv.id !== where.id) return false
  if (where.userId !== undefined && inv.userId !== where.userId) return false
  if (where.expiresAt && !(inv.expiresAt > where.expiresAt.gt)) return false
  return true
}

const db = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const api: any = {
    invitation: {
      create: async ({ data }: { data: Inv }) => {
        store.invitations.set(data.id, { ...data, createdAt: new Date() })
        return data
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        const inv = store.invitations.get(where.id) as Inv | undefined
        if (!inv) return null
        return { ...inv, user: store.users.get(inv.userId), membership: inv.membershipId ? store.memberships.get(inv.membershipId) ?? null : null }
      },
      deleteMany: async ({ where }: { where: Parameters<typeof matches>[1] }) => {
        let count = 0
        for (const [k, v] of [...store.invitations]) {
          if (matches(v as Inv, where)) {
            store.invitations.delete(k)
            count++
          }
        }
        return { count }
      },
    },
    user: {
      findUnique: async ({ where }: { where: { id: string } }) => store.users.get(where.id) ?? null,
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
        const u = store.users.get(where.id)
        if (!u) throw new Error('nenalezeno')
        return u
      },
      update: async ({ where, data }: { where: { id: string }; data: { passwordHash: string; passwordSetByOwner?: boolean } }) => {
        if (store.failUserUpdate) throw new Error('db spadla')
        const u = store.users.get(where.id)!
        u.passwordHash = data.passwordHash
        u.passwordSetByOwner = data.passwordSetByOwner
        return u
      },
    },
    session: {
      deleteMany: async ({ where }: { where: { userId: string } }) => {
        let count = 0
        for (const [k, s] of [...store.sessions]) {
          if (s.userId === where.userId) {
            store.sessions.delete(k)
            count++
          }
        }
        return { count }
      },
    },
    membership: { findUnique: async ({ where }: { where: { id: string } }) => store.memberships.get(where.id) ?? null },
    $transaction: async (fn: (tx: any) => Promise<unknown>) => {
      const snap = {
        i: new Map(store.invitations),
        u: new Map([...store.users].map(([k, v]) => [k, { ...v }])),
        s: new Map(store.sessions),
      }
      try {
        return await fn(api)
      } catch (e) {
        store.invitations = snap.i
        store.users = snap.u
        store.sessions = snap.s
        throw e
      }
    },
  }
  return api
})
vi.mock('@/lib/prisma', () => ({ prisma: db }))

const mail = vi.hoisted(() => ({ sendMail: vi.fn() }))
vi.mock('@/lib/mail', () => mail)

import { appUrl, consumeInvitation, createInvitation, inspectInvitation, inviteByMail, invitationMail, NEPLATNY_ODKAZ } from '@/lib/invitation'
import { sha256, verifyPassword, hashPassword } from '@/lib/crypto'

const HESLO = 'nove-heslo-123'
let puvodniHash: string

beforeEach(async () => {
  vi.clearAllMocks()
  store.invitations = new Map()
  store.sessions = new Map([
    ['s1', { id: 's1', userId: 'u1' }],
    ['s2', { id: 's2', userId: 'u1' }],
    ['s-cizi', { id: 's-cizi', userId: 'u2' }],
  ])
  puvodniHash = await hashPassword('stare-heslo-xyz')
  store.users = new Map([
    ['u1', { id: 'u1', email: 'jan@novak.cz', passwordHash: puvodniHash }],
    ['u2', { id: 'u2', email: 'eva@novak.cz', passwordHash: 'cizi-hash' }],
  ])
  store.memberships = new Map([['m1', { id: 'm1', org: { name: 'Truhlářství <Novák> & syn' } }]])
  store.failUserUpdate = false
  mail.sendMail.mockResolvedValue(true)
  delete process.env.APP_URL
})

describe('createInvitation', () => {
  it('v databázi je sha256(token), nikdy token samotný', async () => {
    const token = await createInvitation({ userId: 'u1', membershipId: 'm1', kind: 'invite' })
    expect(store.invitations.has(token)).toBe(false) // token jako id by znamenal únik tokenu s databází
    expect(store.invitations.has(sha256(token))).toBe(true)
    const row = store.invitations.get(sha256(token)) as Inv
    expect(row.id).not.toBe(token)
    expect(JSON.stringify([...store.invitations])).not.toContain(token)
  })

  it('platí 48 hodin, drží druh a umí membershipId null (obnova hesla)', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-09T10:00:00Z'))
    try {
      const token = await createInvitation({ userId: 'u1', kind: 'reset' })
      const row = store.invitations.get(sha256(token)) as Inv
      expect(row.expiresAt).toEqual(new Date('2026-11-11T10:00:00Z'))
      expect(row.kind).toBe('reset')
      expect(row.membershipId).toBeNull()
      expect(row.userId).toBe('u1')
    } finally {
      vi.useRealTimers()
    }
  })

  it('tokeny jsou náhodné a víc pozvánek jedné osobě je dovoleno', async () => {
    const a = await createInvitation({ userId: 'u1', kind: 'invite' })
    const b = await createInvitation({ userId: 'u1', kind: 'invite' })
    expect(a).not.toBe(b)
    expect(store.invitations.size).toBe(2)
  })
})

describe('consumeInvitation: úspěch', () => {
  it('nastaví heslo (jen jako hash), smaže pozvánku a odhlásí uživatele všude', async () => {
    const token = await createInvitation({ userId: 'u1', membershipId: 'm1', kind: 'invite' })
    expect(await consumeInvitation(token, HESLO)).toEqual({ ok: true })
    const u = store.users.get('u1')!
    expect(u.passwordHash).not.toBe(puvodniHash)
    expect(u.passwordHash).not.toContain(HESLO)
    expect(await verifyPassword(HESLO, u.passwordHash)).toBe(true)
    expect(store.invitations.size).toBe(0)
    // Všechny relace tohoto uživatele pryč, cizí zůstává.
    expect([...store.sessions.keys()]).toEqual(['s-cizi'])
    expect(store.users.get('u2')!.passwordHash).toBe('cizi-hash')
  })

  it('označí heslo jako nastavené majitelem účtu (zneplatnění při připojení do další firmy na tom stojí)', async () => {
    const token = await createInvitation({ userId: 'u1', membershipId: 'm1', kind: 'invite' })
    await consumeInvitation(token, HESLO)
    expect(store.users.get('u1')!.passwordSetByOwner).toBe(true)
    expect(store.users.get('u2')!.passwordSetByOwner).toBeUndefined()
  })

  it('smaže i ostatní nevyřízené odkazy téhož člověka, cizí ne', async () => {
    const t1 = await createInvitation({ userId: 'u1', kind: 'reset' })
    await createInvitation({ userId: 'u1', kind: 'invite' })
    const cizi = await createInvitation({ userId: 'u2', kind: 'reset' })
    await consumeInvitation(t1, HESLO)
    expect([...store.invitations.keys()]).toEqual([sha256(cizi)])
  })

  it('funguje i bez členství (obnova hesla, membershipId null)', async () => {
    const token = await createInvitation({ userId: 'u1', kind: 'reset' })
    expect(await consumeInvitation(token, HESLO)).toEqual({ ok: true })
  })
})

describe('consumeInvitation: použitá a prošlá pozvánka (hlavní selhání úkolu)', () => {
  it('druhé použití selže česky, protože řádek zmizel, a heslo zůstane z prvního použití', async () => {
    const token = await createInvitation({ userId: 'u1', kind: 'invite' })
    await consumeInvitation(token, HESLO)
    expect(store.invitations.has(sha256(token))).toBe(false)
    const hashPoPrvnim = store.users.get('u1')!.passwordHash
    const r = await consumeInvitation(token, 'utocnik-heslo-99')
    expect(r).toEqual({ error: NEPLATNY_ODKAZ })
    expect(store.users.get('u1')!.passwordHash).toBe(hashPoPrvnim)
    expect(await verifyPassword('utocnik-heslo-99', store.users.get('u1')!.passwordHash)).toBe(false)
  })

  it('druhé použití po novém přihlášení nesmí odhlásit nové relace', async () => {
    const token = await createInvitation({ userId: 'u1', kind: 'invite' })
    await consumeInvitation(token, HESLO)
    store.sessions.set('s-nova', { id: 's-nova', userId: 'u1' })
    await consumeInvitation(token, 'utocnik-heslo-99')
    expect(store.sessions.has('s-nova')).toBe(true)
  })

  it('souběžné použití téhož odkazu uspěje právě jednou (zámek drží smazání řádku, ne předchozí čtení)', async () => {
    const token = await createInvitation({ userId: 'u1', kind: 'invite' })
    // Obě volání projdou kontrolou „řádek existuje“ dřív, než kterékoli smaže (bcrypt mezi tím čeká).
    const [a, b] = await Promise.all([consumeInvitation(token, 'prvni-heslo-111'), consumeInvitation(token, 'druhe-heslo-222')])
    const vysledky = [a, b]
    expect(vysledky.filter((r) => 'ok' in r)).toHaveLength(1)
    expect(vysledky.filter((r) => 'error' in r)).toEqual([{ error: NEPLATNY_ODKAZ }])
    const vitez = 'ok' in a ? 'prvni-heslo-111' : 'druhe-heslo-222'
    const porazeny = 'ok' in a ? 'druhe-heslo-222' : 'prvni-heslo-111'
    expect(await verifyPassword(vitez, store.users.get('u1')!.passwordHash)).toBe(true)
    expect(await verifyPassword(porazeny, store.users.get('u1')!.passwordHash)).toBe(false)
  })

  describe('po expiresAt', () => {
    afterEach(() => vi.useRealTimers())

    it('selže česky, heslo ani relace se nezmění', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-11-09T10:00:00Z'))
      const token = await createInvitation({ userId: 'u1', kind: 'invite' })
      vi.setSystemTime(new Date('2026-11-11T10:00:01Z')) // o vteřinu po expiraci
      expect(await consumeInvitation(token, HESLO)).toEqual({ error: NEPLATNY_ODKAZ })
      expect(store.users.get('u1')!.passwordHash).toBe(puvodniHash)
      expect(store.sessions.size).toBe(3)
    })

    it('přesně v čase expirace už neplatí; o vteřinu dřív ještě ano', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-11-09T10:00:00Z'))
      const t1 = await createInvitation({ userId: 'u1', kind: 'invite' })
      vi.setSystemTime(new Date('2026-11-11T10:00:00Z'))
      expect(await consumeInvitation(t1, HESLO)).toEqual({ error: NEPLATNY_ODKAZ })
      vi.setSystemTime(new Date('2026-11-09T10:00:00Z'))
      const t2 = await createInvitation({ userId: 'u1', kind: 'invite' })
      vi.setSystemTime(new Date('2026-11-11T09:59:59Z'))
      expect(await consumeInvitation(t2, HESLO)).toEqual({ ok: true })
    })

    it('hranice se hlídá i uvnitř transakce: pozvánka vyprší během hashování hesla', async () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2026-11-09T10:00:00Z'))
      const token = await createInvitation({ userId: 'u1', kind: 'invite' })
      vi.setSystemTime(new Date('2026-11-11T09:59:59.999Z'))
      const puvodniFind = db.invitation.findUnique
      // Čtení ještě projde, pak se čas posune za expiraci (simulace pomalého bcryptu).
      db.invitation.findUnique = async (a: { where: { id: string } }) => {
        const r = await puvodniFind(a)
        vi.setSystemTime(new Date('2026-11-11T10:00:05Z'))
        return r
      }
      try {
        expect(await consumeInvitation(token, HESLO)).toEqual({ error: NEPLATNY_ODKAZ })
      } finally {
        db.invitation.findUnique = puvodniFind
      }
      expect(store.users.get('u1')!.passwordHash).toBe(puvodniHash)
    })
  })

  it('neznámý token: chyba, žádný zápis', async () => {
    await createInvitation({ userId: 'u1', kind: 'invite' })
    expect(await consumeInvitation('x'.repeat(43), HESLO)).toEqual({ error: NEPLATNY_ODKAZ })
    expect(store.invitations.size).toBe(1)
    expect(store.users.get('u1')!.passwordHash).toBe(puvodniHash)
  })

  it('nesmyslný token (prázdný, příliš dlouhý) skončí chybou bez dotazu do databáze', async () => {
    const find = vi.spyOn(db.invitation, 'findUnique')
    expect(await consumeInvitation('', HESLO)).toEqual({ error: NEPLATNY_ODKAZ })
    expect(await consumeInvitation('a'.repeat(5000), HESLO)).toEqual({ error: NEPLATNY_ODKAZ })
    expect(find).not.toHaveBeenCalled()
    find.mockRestore()
  })
})

describe('consumeInvitation: ostatní', () => {
  it('slabé heslo odmítne a pozvánku nespálí', async () => {
    const token = await createInvitation({ userId: 'u1', kind: 'invite' })
    const r = await consumeInvitation(token, 'krátké')
    expect(r).toHaveProperty('error')
    expect(store.invitations.has(sha256(token))).toBe(true)
    expect(await consumeInvitation(token, HESLO)).toEqual({ ok: true })
  })

  it('heslo delší než 200 znaků se odmítne správnou hláškou (ne „aspoň 10“)', async () => {
    const token = await createInvitation({ userId: 'u1', kind: 'invite' })
    expect(await consumeInvitation(token, 'x'.repeat(201))).toEqual({ error: 'Heslo může mít nejvýše 200 znaků.' })
    expect(await consumeInvitation(token, 'krátké')).toEqual({ error: 'Heslo musí mít aspoň 10 znaků.' })
    expect(store.invitations.has(sha256(token))).toBe(true)
  })

  it('token jiného tvaru než 43 znaků base64url se odmítne bez dotazu do databáze', async () => {
    const find = vi.spyOn(db.invitation, 'findUnique')
    for (const t of ['a'.repeat(42), 'a'.repeat(44), 'a'.repeat(42) + '!', 'a'.repeat(42) + '=']) {
      expect(await consumeInvitation(t, HESLO)).toEqual({ error: NEPLATNY_ODKAZ })
      expect(await inspectInvitation(t)).toBeNull()
    }
    expect(find).not.toHaveBeenCalled()
    find.mockRestore()
  })

  it('selže-li zápis hesla, transakce se vrátí: pozvánka i relace zůstanou', async () => {
    const token = await createInvitation({ userId: 'u1', kind: 'invite' })
    store.failUserUpdate = true
    const r = await consumeInvitation(token, HESLO)
    expect(r).toHaveProperty('error')
    expect(r).not.toEqual({ error: NEPLATNY_ODKAZ }) // jiná, obecná chyba: dá se to zkusit znovu
    expect(store.invitations.has(sha256(token))).toBe(true)
    expect(store.sessions.size).toBe(3)
    store.failUserUpdate = false
    expect(await consumeInvitation(token, HESLO)).toEqual({ ok: true })
  })

  it('inspectInvitation: platná ano, použitá a prošlá ne', async () => {
    const token = await createInvitation({ userId: 'u1', membershipId: 'm1', kind: 'invite' })
    expect(await inspectInvitation(token)).toMatchObject({ kind: 'invite', email: 'jan@novak.cz', orgName: 'Truhlářství <Novák> & syn' })
    await consumeInvitation(token, HESLO)
    expect(await inspectInvitation(token)).toBeNull()
  })

  it('inspectInvitation: membershipId null dá orgName null', async () => {
    const token = await createInvitation({ userId: 'u1', kind: 'reset' })
    expect(await inspectInvitation(token)).toMatchObject({ kind: 'reset', orgName: null })
  })
})

describe('inviteByMail a e-mail', () => {
  it('nepodaří-li se odeslat, pozvánka přesto platí a volající se to dozví', async () => {
    mail.sendMail.mockResolvedValue(false)
    const r = await inviteByMail({ userId: 'u1', membershipId: 'm1', kind: 'invite' })
    expect(r).toEqual({ emailed: false })
    expect(store.invitations.size).toBe(1)
  })

  it('odkaz míří na APP_URL; bez ní na produkční adresu; token je v odkazu, ne v předmětu', async () => {
    await inviteByMail({ userId: 'u1', kind: 'reset' })
    const [komu, predmet, html] = mail.sendMail.mock.calls[0]
    expect(komu).toBe('jan@novak.cz')
    expect(html).toMatch(/https:\/\/dohazka\.jede\.online\/pozvanka\/[A-Za-z0-9_-]{43}/)
    const token = /pozvanka\/([A-Za-z0-9_-]{43})/.exec(html)![1]
    expect(store.invitations.has(sha256(token))).toBe(true)
    expect(predmet).not.toContain(token)

    process.env.APP_URL = 'http://localhost:3000/'
    await inviteByMail({ userId: 'u1', kind: 'reset' })
    expect(mail.sendMail.mock.calls[1][2]).toContain('http://localhost:3000/pozvanka/')
    expect(appUrl()).toBe('http://localhost:3000')
  })

  it('větev bez členství (membershipId null): žádné vyhledávání firmy, e-mail bez jména firmy', async () => {
    const find = vi.spyOn(db.membership, 'findUnique')
    await inviteByMail({ userId: 'u1', membershipId: null, kind: 'invite' })
    expect(find).not.toHaveBeenCalled()
    const [, predmet, html] = mail.sendMail.mock.calls[0]
    expect(predmet).toBe('Docházka: pozvánka')
    expect(html).toContain('do Docházky')
    find.mockRestore()
  })

  it('členství, které mezitím zmizelo, nerozbije odeslání', async () => {
    const r = await inviteByMail({ userId: 'u1', membershipId: 'neexistuje', kind: 'invite' })
    expect(r).toEqual({ emailed: true })
    expect(mail.sendMail.mock.calls[0][1]).toBe('Docházka: pozvánka')
  })

  it('e-mail má i textovou alternativu s odkazem (pozvánka i obnova)', async () => {
    await inviteByMail({ userId: 'u1', membershipId: 'm1', kind: 'invite' })
    await inviteByMail({ userId: 'u1', kind: 'reset' })
    for (const c of mail.sendMail.mock.calls) {
      expect(c[3]).toMatch(/https:\/\/dohazka\.jede\.online\/pozvanka\/[A-Za-z0-9_-]{43}/)
      expect(c[3]).not.toContain('<a ')
    }
    expect(mail.sendMail.mock.calls[0][3]).toContain('Truhlářství <Novák> & syn') // v textu se neescapuje
  })

  it('jméno firmy se v HTML escapuje', async () => {
    await inviteByMail({ userId: 'u1', membershipId: 'm1', kind: 'invite' })
    const html = mail.sendMail.mock.calls[0][2] as string
    expect(html).toContain('Truhlářství &lt;Novák&gt; &amp; syn')
    expect(html).not.toContain('<Novák>')
  })

  it('invitationMail: obnova hesla je česky a nezmiňuje firmu', () => {
    const m = invitationMail('reset', 'Firma', 'https://x/pozvanka/t')
    expect(m.subject).toContain('hesla')
    expect(m.html).not.toContain('Firma')
  })
})

describe('sendMail', () => {
  const fetchMock = vi.fn()
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  async function skutecny() {
    vi.resetModules()
    vi.doUnmock('@/lib/mail')
    return (await vi.importActual<typeof import('@/lib/mail')>('@/lib/mail')).sendMail
  }

  it('bez RESEND_API_KEY vrátí false a nevolá síť', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    const sendMail = await skutecny()
    await expect(sendMail('a@b.cz', 'x', '<p>x</p>')).resolves.toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('chybějící klíč zaloguje jednou za běh, ne při každém e-mailu', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const sendMail = await skutecny()
    await sendMail('a@b.cz', 'x', 'y')
    await sendMail('a@b.cz', 'x', 'y')
    expect(log).toHaveBeenCalledTimes(1)
    expect(log.mock.calls[0][0]).toContain('RESEND_API_KEY')
    log.mockRestore()
  })

  it('textová alternativa jde v těle požadavku', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test')
    fetchMock.mockResolvedValue({ ok: true, status: 200 })
    const sendMail = await skutecny()
    await sendMail('a@b.cz', 'x', '<p>y</p>', 'y')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ html: '<p>y</p>', text: 'y' })
  })

  it('chyba sítě nevyhodí výjimku', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test')
    fetchMock.mockRejectedValue(new Error('síť'))
    const sendMail = await skutecny()
    await expect(sendMail('a@b.cz', 'x', 'y')).resolves.toBe(false)
  })

  it('odmítnutí od Resendu (ne-2xx) vrátí false', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test')
    fetchMock.mockResolvedValue({ ok: false, status: 403 })
    const sendMail = await skutecny()
    await expect(sendMail('a@b.cz', 'x', 'y')).resolves.toBe(false)
  })

  it('úspěch: true, správný příjemce a klíč v hlavičce, ne v těle', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test')
    fetchMock.mockResolvedValue({ ok: true, status: 200 })
    const sendMail = await skutecny()
    await expect(sendMail('a@b.cz', 'Předmět', '<p>x</p>')).resolves.toBe(true)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.resend.com/emails')
    expect(init.headers.Authorization).toBe('Bearer re_test')
    expect(JSON.parse(init.body)).toMatchObject({ to: ['a@b.cz'], subject: 'Předmět' })
    expect(init.body).not.toContain('re_test')
  })
})
