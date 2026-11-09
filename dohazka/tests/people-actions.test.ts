import { beforeEach, describe, expect, it, vi } from 'vitest'

// Skutečné requireCan / getOrgContext / can zůstávají; nahrazujeme jen okolí (přihlášení, Next, databáze).
vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => ({ get: () => undefined })) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`)
  }),
}))
const auth = vi.hoisted(() => ({ requireUser: vi.fn(), getCurrentUser: vi.fn() }))
vi.mock('@/lib/auth', () => auth)
const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  session: { deleteMany: vi.fn() },
  membership: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
  $transaction: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
const inv = vi.hoisted(() => ({ createInvitation: vi.fn(), sendInvitationMail: vi.fn(), notifyAddedToOrg: vi.fn() }))
vi.mock('@/lib/invitation', () => inv)
const rl = vi.hoisted(() => ({ rateLimit: vi.fn() }))
vi.mock('@/lib/rate-limit', () => rl)

import { addPerson, resendInvitation, setActive, setRole } from '@/app/actions/people'
import * as peopleModule from '@/app/actions/people'
import { personSchema } from '@/lib/validation'

const org = { id: 'o1', name: 'Firma', reportName: 'Firma s.r.o.', periodStartDay: 1, remindHour: 20 }
function jaJsem(role: 'OWNER' | 'ACCOUNTANT' | 'EMPLOYEE', isSuperAdmin = false) {
  auth.getCurrentUser.mockResolvedValue({ id: 'u-me', isSuperAdmin })
  db.membership.findMany.mockResolvedValue([{ id: 'm-me', orgId: 'o1', role, active: true, tracksFrom: new Date(), org }])
}
const zapisyMembership = () =>
  db.membership.create.mock.calls.length + db.membership.update.mock.calls.length + db.membership.updateMany.mock.calls.length +
  db.membership.delete.mock.calls.length + db.membership.deleteMany.mock.calls.length
const zapisy = () => zapisyMembership() + db.user.create.mock.calls.length + db.user.update.mock.calls.length

const vstup = { email: ' Eva@Firma.CZ ', name: 'Eva Nová', role: 'EMPLOYEE' as const }

beforeEach(() => {
  vi.clearAllMocks()
  jaJsem('OWNER')
  db.$transaction.mockImplementation(async (fn: (tx: typeof db) => unknown) => fn(db))
  db.user.findUnique.mockResolvedValue(null)
  db.user.create.mockResolvedValue({ id: 'u-new' })
  db.membership.findFirst.mockResolvedValue(null)
  db.membership.count.mockResolvedValue(1)
  db.membership.create.mockResolvedValue({ id: 'm-new' })
  db.membership.updateMany.mockResolvedValue({ count: 1 })
  db.user.updateMany.mockResolvedValue({ count: 1 })
  rl.rateLimit.mockReturnValue(true)
  inv.createInvitation.mockResolvedValue('tok')
  inv.sendInvitationMail.mockResolvedValue({ emailed: true })
  inv.notifyAddedToOrg.mockResolvedValue(true)
})

describe('oprávnění: fail-closed pro všechny tři akce', () => {
  it.each(['ACCOUNTANT', 'EMPLOYEE'] as const)('%s: žádná akce nic nezapíše ani nezačne transakci', async (role) => {
    jaJsem(role)
    await expect(addPerson(vstup)).rejects.toThrow('NEXT_REDIRECT:/')
    await expect(setRole('m1', 'OWNER')).rejects.toThrow('NEXT_REDIRECT:/')
    await expect(setActive('m1', false)).rejects.toThrow('NEXT_REDIRECT:/')
    expect(db.$transaction).not.toHaveBeenCalled()
    expect(zapisy()).toBe(0)
  })

  it('nepřihlášený se přesměruje na přihlášení a nic nezapíše', async () => {
    auth.getCurrentUser.mockResolvedValue(null)
    await expect(setActive('m1', false)).rejects.toThrow('NEXT_REDIRECT:/prihlaseni')
    expect(db.$transaction).not.toHaveBeenCalled()
    expect(zapisy()).toBe(0)
  })

  it('kontrola je před validací: cizí s neplatným vstupem se dozví jen přesměrování', async () => {
    jaJsem('EMPLOYEE')
    await expect(addPerson({ ...vstup, email: 'ne' })).rejects.toThrow('NEXT_REDIRECT:/')
  })
})

describe('Review Focus 5: členství z cizí firmy', () => {
  beforeEach(() => {
    // Věrná náhrada databáze: řádek patří firmě o2 a vrátí se, pokud ho `where` nevylučuje.
    // Dotaz BEZ orgId by ho tedy našel (a zápis by proběhl); jen dotaz s orgId aktivní firmy o1 ne.
    db.membership.findFirst.mockImplementation(async ({ where }: { where: { id: string; orgId?: string } }) =>
      where.id === 'm-cizi' && (where.orgId === undefined || where.orgId === 'o2') ? { id: 'm-cizi', role: 'EMPLOYEE', active: true } : null,
    )
  })

  it('setRole na cizí členství: chyba a žádný zápis (update ani updateMany nezavolány)', async () => {
    const r = await setRole('m-cizi', 'OWNER')
    expect(r).toHaveProperty('error')
    expect(db.membership.update).not.toHaveBeenCalled()
    expect(db.membership.updateMany).not.toHaveBeenCalled()
    expect(zapisy()).toBe(0)
  })

  it('setActive na cizí členství: chyba a žádný zápis', async () => {
    const r = await setActive('m-cizi', false)
    expect(r).toHaveProperty('error')
    expect(db.membership.update).not.toHaveBeenCalled()
    expect(db.membership.updateMany).not.toHaveBeenCalled()
    expect(zapisy()).toBe(0)
  })

  it('každý dotaz nad Membership nese orgId aktivní firmy a zápis také', async () => {
    db.membership.findFirst.mockResolvedValue({ id: 'm1', role: 'EMPLOYEE', active: true })
    await setRole('m1', 'ACCOUNTANT')
    expect(db.membership.findFirst.mock.calls[0][0].where).toMatchObject({ id: 'm1', orgId: 'o1' })
    expect(db.membership.updateMany.mock.calls[0][0].where).toEqual({ id: 'm1', orgId: 'o1' })
    expect(db.membership.updateMany.mock.calls[0][0].data).toEqual({ role: 'ACCOUNTANT' })
  })

  it('počítání ostatních správců je také jen v rámci vlastní firmy', async () => {
    db.membership.findFirst.mockResolvedValue({ id: 'm1', role: 'OWNER', active: true })
    await setActive('m1', false)
    expect(db.membership.count.mock.calls[0][0].where).toMatchObject({ orgId: 'o1', role: 'OWNER', active: true })
  })

  it('i když se řádek mezitím přesune (updateMany vrátí 0), akce skončí chybou', async () => {
    db.membership.findFirst.mockResolvedValue({ id: 'm1', role: 'EMPLOYEE', active: true })
    db.membership.updateMany.mockResolvedValue({ count: 0 })
    expect(await setActive('m1', false)).toHaveProperty('error')
  })
})

describe('poslední aktivní správce (OWNER)', () => {
  beforeEach(() => {
    db.membership.findFirst.mockResolvedValue({ id: 'm-own', role: 'OWNER', active: true })
    db.membership.count.mockResolvedValue(0) // žádný jiný aktivní OWNER
  })

  it('nejde deaktivovat', async () => {
    const r = await setActive('m-own', false)
    expect(r).toHaveProperty('error')
    expect(db.membership.updateMany).not.toHaveBeenCalled()
    expect(db.membership.update).not.toHaveBeenCalled()
  })

  it.each(['ACCOUNTANT', 'EMPLOYEE'])('nejde přeřadit na %s', async (role) => {
    const r = await setRole('m-own', role)
    expect(r).toHaveProperty('error')
    expect(db.membership.updateMany).not.toHaveBeenCalled()
    expect(db.membership.update).not.toHaveBeenCalled()
  })

  it('počet se ptá na OSTATNÍ aktivní správce (vlastní řádek se nepočítá)', async () => {
    await setActive('m-own', false)
    expect(db.membership.count.mock.calls[0][0].where).toMatchObject({ role: 'OWNER', active: true, id: { not: 'm-own' } })
  })

  it('s dalším aktivním správcem to projde', async () => {
    db.membership.count.mockResolvedValue(1)
    expect(await setActive('m-own', false)).toEqual({ ok: true })
    expect(db.membership.updateMany).toHaveBeenCalledWith({ where: { id: 'm-own', orgId: 'o1' }, data: { active: false } })
    expect(await setRole('m-own', 'EMPLOYEE')).toEqual({ ok: true })
  })

  it('ponechání role OWNER a aktivace posledního správce jsou povolené', async () => {
    expect(await setRole('m-own', 'OWNER')).toEqual({ ok: true })
    expect(await setActive('m-own', true)).toEqual({ ok: true })
  })

  it('už neaktivního správce lze přeřadit i bez dalšího (firma o nic nepřijde)', async () => {
    db.membership.findFirst.mockResolvedValue({ id: 'm-own', role: 'OWNER', active: false })
    expect(await setRole('m-own', 'EMPLOYEE')).toEqual({ ok: true })
  })

  it('kontrola a zápis jsou v jedné serializovatelné transakci', async () => {
    await setActive('m-own', false)
    expect(db.$transaction).toHaveBeenCalledTimes(1)
    expect(db.$transaction.mock.calls[0][1]).toMatchObject({ isolationLevel: 'Serializable' })
  })
})

describe('setRole / setActive: vstup', () => {
  it('neznámá role se odmítne a nic se nezapíše', async () => {
    expect(await setRole('m1', 'SUPERADMIN')).toHaveProperty('error')
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it('obyčejný zaměstnanec se dá deaktivovat a znovu aktivovat', async () => {
    db.membership.findFirst.mockResolvedValue({ id: 'm1', role: 'EMPLOYEE', active: true })
    expect(await setActive('m1', false)).toEqual({ ok: true })
    expect(await setActive('m1', true)).toEqual({ ok: true })
    expect(db.membership.count).not.toHaveBeenCalled()
  })

  it('nikdy se nemaže: žádné delete', async () => {
    db.membership.findFirst.mockResolvedValue({ id: 'm1', role: 'EMPLOYEE', active: true })
    await setActive('m1', false)
    expect(db.membership.delete).not.toHaveBeenCalled()
    expect(db.membership.deleteMany).not.toHaveBeenCalled()
  })
})

describe('addPerson: nový člověk', () => {
  it('vytvoří účet s normalizovaným e-mailem a členství v AKTIVNÍ firmě s vybranou rolí', async () => {
    const r = await addPerson({ ...vstup, delivery: 'invite' })
    expect(r).toEqual({ ok: true, invite: { emailed: true, created: true } })
    expect(db.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { email: 'eva@firma.cz' } }))
    expect(db.user.create.mock.calls[0][0].data).toMatchObject({ email: 'eva@firma.cz', name: 'Eva Nová' })
    expect(db.user.create.mock.calls[0][0].data.isSuperAdmin).not.toBe(true)
    expect(db.membership.create.mock.calls[0][0].data).toMatchObject({ userId: 'u-new', orgId: 'o1', role: 'EMPLOYEE', active: true })
    expect(inv.createInvitation).toHaveBeenCalledWith({ userId: 'u-new', membershipId: 'm-new', kind: 'invite' }, db)
    expect(inv.sendInvitationMail).toHaveBeenCalledWith({ userId: 'u-new', membershipId: 'm-new', kind: 'invite', token: 'tok' })
  })

  it('orgId se bere z kontextu, nikdy z cizího pole ve vstupu', async () => {
    await addPerson({ ...vstup, orgId: 'o2' } as never)
    expect(db.membership.create.mock.calls[0][0].data.orgId).toBe('o1')
  })

  it('pozvánka se vytvoří až po transakci', async () => {
    const poradi: string[] = []
    db.$transaction.mockImplementation(async (fn: (tx: typeof db) => unknown) => {
      const r = await fn(db)
      poradi.push('commit')
      return r
    })
    inv.sendInvitationMail.mockImplementation(async () => {
      poradi.push('invite')
      return { emailed: true }
    })
    await addPerson({ ...vstup, delivery: 'invite' })
    expect(poradi).toEqual(['commit', 'invite'])
  })

  it('e-mail neodešel: vrátí vygenerované heslo (hash v databázi, ne heslo)', async () => {
    inv.sendInvitationMail.mockResolvedValue({ emailed: false })
    const r = (await addPerson({ ...vstup, delivery: 'invite' })) as { password?: string; invite?: unknown }
    expect(r.password).toMatch(/^[A-Za-z0-9]{16}$/)
    expect(r.invite).toEqual({ emailed: false, created: true })
    const hash = db.user.create.mock.calls[0][0].data.passwordHash
    expect(hash).toMatch(/^\$2[aby]\$/)
    expect(hash).not.toContain(r.password)
  })

  it('řádek pozvánky vzniká UVNITŘ transakce; selže-li, vrátí se celá (člen bez pozvánky nezůstane) a heslo se nevrací', async () => {
    const potvrzeno: string[] = []
    db.$transaction.mockImplementation(async (fn: (tx: typeof db) => Promise<unknown>) => {
      const r = await fn(db)
      potvrzeno.push('commit')
      return r
    })
    inv.createInvitation.mockRejectedValue(new Error('db'))
    const r = await addPerson({ ...vstup, delivery: 'invite' })
    expect(r).toHaveProperty('error')
    expect(r).not.toHaveProperty('password')
    expect(potvrzeno).toEqual([])
    expect(inv.sendInvitationMail).not.toHaveBeenCalled()
  })

  it('volba "heslo": vrátí heslo a nic nepošle', async () => {
    const r = (await addPerson({ ...vstup, delivery: 'password' })) as { password?: string }
    expect(r.password).toMatch(/^[A-Za-z0-9]{16}$/)
    expect(inv.createInvitation).not.toHaveBeenCalled()
    expect(inv.sendInvitationMail).not.toHaveBeenCalled()
  })

  it('neplatný vstup: chyba a žádný zápis', async () => {
    for (const zmena of [{ email: 'neni' }, { name: '  ' }, { role: 'ROOT' }]) {
      expect(await addPerson({ ...vstup, ...zmena } as never)).toHaveProperty('error')
    }
    expect(db.$transaction).not.toHaveBeenCalled()
    expect(zapisy()).toBe(0)
  })

  it('chyba databáze: obecná chyba, nic nevyzradí', async () => {
    db.membership.create.mockRejectedValue(new Error('unique constraint on secret_table'))
    const r = (await addPerson(vstup)) as { error: string }
    expect(r.error).not.toContain('secret_table')
  })
})

describe('addPerson: existující e-mail, heslo nastavil majitel účtu', () => {
  beforeEach(() => {
    db.user.findUnique.mockResolvedValue({ id: 'u-old', passwordSetByOwner: true })
  })

  it('připojí existující účet: žádný nový uživatel, žádný zápis do uživatele (heslo, jméno), žádné rušení relací', async () => {
    const r = await addPerson({ ...vstup, name: 'Jiné jméno', delivery: 'password' })
    expect(r).toEqual({ ok: true, existing: { emailed: true } })
    expect(db.user.create).not.toHaveBeenCalled()
    expect(db.user.update).not.toHaveBeenCalled()
    expect(db.user.updateMany).not.toHaveBeenCalled()
    expect(db.session.deleteMany).not.toHaveBeenCalled()
    expect(db.membership.create).toHaveBeenCalledTimes(1)
    expect(db.membership.create.mock.calls[0][0].data).toMatchObject({ userId: 'u-old', orgId: 'o1', role: 'EMPLOYEE' })
  })

  it('nevrací heslo (ani při volbě "heslo"), nevytvoří pozvánku, jen informační e-mail', async () => {
    const r = await addPerson({ ...vstup, delivery: 'password' })
    expect(r).not.toHaveProperty('password')
    expect(inv.createInvitation).not.toHaveBeenCalled()
    expect(inv.sendInvitationMail).not.toHaveBeenCalled()
    expect(inv.notifyAddedToOrg).toHaveBeenCalledWith('u-old', 'Firma')
  })

  it('už je členem téhle firmy (i neaktivní): chyba, žádný zápis, hledá se jen v této firmě', async () => {
    db.membership.findFirst.mockResolvedValue({ id: 'm-x' })
    const r = await addPerson(vstup)
    expect(r).toHaveProperty('error')
    expect(zapisy()).toBe(0)
    expect(db.session.deleteMany).not.toHaveBeenCalled()
    expect(db.user.updateMany).not.toHaveBeenCalled()
    expect(db.membership.findFirst.mock.calls[0][0].where).toEqual({ userId: 'u-old', orgId: 'o1' })
  })
})

describe('addPerson: existující e-mail, heslo zná jiný správce (eskalace napříč firmami)', () => {
  beforeEach(() => {
    db.user.findUnique.mockResolvedValue({ id: 'u-old', passwordSetByOwner: false })
  })

  it('heslo se přepíše, relace zruší, vznikne členství a řádek pozvánky, vše před commitem; mail až po něm', async () => {
    const poradi: string[] = []
    db.$transaction.mockImplementation(async (fn: (tx: typeof db) => unknown) => {
      const r = await fn(db)
      poradi.push('commit')
      return r
    })
    db.user.updateMany.mockImplementation(async () => (poradi.push('update'), { count: 1 }))
    db.session.deleteMany.mockImplementation(async () => poradi.push('sessions'))
    db.membership.create.mockImplementation(async () => (poradi.push('membership'), { id: 'm-new' }))
    inv.createInvitation.mockImplementation(async () => (poradi.push('invitation'), 'tok'))
    inv.sendInvitationMail.mockImplementation(async () => (poradi.push('mail'), { emailed: true }))
    await addPerson({ ...vstup, delivery: 'password' })
    expect(poradi).toEqual(['update', 'sessions', 'membership', 'invitation', 'commit', 'mail'])
    const upd = db.user.updateMany.mock.calls[0][0]
    // Podmínka passwordSetByOwner: false je zámek proti souběhu s consumeInvitation.
    expect(upd.where).toEqual({ id: 'u-old', passwordSetByOwner: false })
    expect(Object.keys(upd.data)).toEqual(['passwordHash']) // jméno ani příznak se nemění; příznak zůstává false
    expect(upd.data.passwordHash).toMatch(/^\$2[aby]\$/)
    expect(db.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u-old' } })
    expect(db.user.create).not.toHaveBeenCalled()
  })

  it('souběh: majitel si mezitím nastavil vlastní heslo (updateMany count 0) - nic se nepřepíše, relace zůstanou, jen informační e-mail', async () => {
    db.user.updateMany.mockResolvedValue({ count: 0 })
    const r = await addPerson(vstup)
    expect(db.session.deleteMany).not.toHaveBeenCalled()
    expect(inv.createInvitation).not.toHaveBeenCalled()
    expect(inv.notifyAddedToOrg).toHaveBeenCalledTimes(1)
    expect(r).toEqual({ ok: true, existing: { emailed: true } })
  })

  it('správci se nevrací žádné heslo ani u volby "heslo"; odejde pozvánka (kind invite)', async () => {
    const r = await addPerson({ ...vstup, delivery: 'password' })
    expect(r).toEqual({ ok: true, existing: { emailed: true } })
    expect(r).not.toHaveProperty('password')
    expect(inv.createInvitation).toHaveBeenCalledWith({ userId: 'u-old', membershipId: 'm-new', kind: 'invite' }, db)
    expect(inv.sendInvitationMail).toHaveBeenCalledWith({ userId: 'u-old', membershipId: 'm-new', kind: 'invite', token: 'tok' })
    expect(inv.notifyAddedToOrg).not.toHaveBeenCalled()
  })

  it('odpověď pro existující účet je stejná bez ohledu na příznak (nic neprozradí o účtu)', async () => {
    const a = await addPerson(vstup)
    db.user.findUnique.mockResolvedValue({ id: 'u-old', passwordSetByOwner: true })
    const b = await addPerson(vstup)
    expect(a).toEqual(b)
  })

  it('e-mail neodešel: i tak žádné heslo (správce by ho znal)', async () => {
    inv.sendInvitationMail.mockResolvedValueOnce({ emailed: false })
    const r = await addPerson(vstup)
    expect(r).not.toHaveProperty('password')
    expect(r).toEqual({ ok: true, existing: { emailed: false } })
  })

  it('selže-li zneplatnění nebo vytvoření pozvánky, členství nevznikne (transakce se vrátí) a akce skončí chybou', async () => {
    for (const rozbit of [() => db.session.deleteMany.mockRejectedValueOnce(new Error('db')), () => inv.createInvitation.mockRejectedValueOnce(new Error('db'))]) {
      const potvrzeno: string[] = []
      db.$transaction.mockImplementation(async (fn: (tx: typeof db) => Promise<unknown>) => {
        const r = await fn(db)
        potvrzeno.push('commit')
        return r
      })
      rozbit()
      expect(await addPerson(vstup)).toHaveProperty('error')
      expect(potvrzeno).toEqual([])
    }
    expect(inv.sendInvitationMail).not.toHaveBeenCalled()
  })

  it('nový účet se zneplatnění netýká (nepřepisuje se, nic se neruší)', async () => {
    db.user.findUnique.mockResolvedValue(null)
    await addPerson(vstup)
    expect(db.user.updateMany).not.toHaveBeenCalled()
    expect(db.session.deleteMany).not.toHaveBeenCalled()
  })
})

describe('resendInvitation', () => {
  beforeEach(() => {
    db.membership.findFirst.mockResolvedValue({ id: 'm1', userId: 'u-x' })
  })

  it('vytvoří novou pozvánku a pošle e-mail; hledá jen aktivní členství VLASTNÍ firmy', async () => {
    const r = await resendInvitation('m1')
    expect(r).toEqual({ ok: true, emailed: true })
    expect(db.membership.findFirst.mock.calls[0][0].where).toEqual({ id: 'm1', orgId: 'o1', active: true })
    expect(inv.createInvitation).toHaveBeenCalledWith({ userId: 'u-x', membershipId: 'm1', kind: 'invite' })
    expect(inv.sendInvitationMail).toHaveBeenCalledWith({ userId: 'u-x', membershipId: 'm1', kind: 'invite', token: 'tok' })
  })

  it('členství z cizí firmy: chyba, žádná pozvánka ani e-mail', async () => {
    db.membership.findFirst.mockImplementation(async ({ where }: { where: { orgId?: string } }) =>
      where.orgId === undefined || where.orgId === 'o2' ? { id: 'm-cizi', userId: 'u-cizi' } : null,
    )
    const r = await resendInvitation('m-cizi')
    expect(r).toHaveProperty('error')
    expect(inv.createInvitation).not.toHaveBeenCalled()
    expect(inv.sendInvitationMail).not.toHaveBeenCalled()
  })

  it.each(['ACCOUNTANT', 'EMPLOYEE'] as const)('%s: přesměrování a žádná pozvánka', async (role) => {
    jaJsem(role)
    await expect(resendInvitation('m1')).rejects.toThrow('NEXT_REDIRECT:/')
    expect(inv.createInvitation).not.toHaveBeenCalled()
  })

  it('limit četnosti: po vyčerpání (na správce i na adresáta) chyba a žádná pozvánka ani e-mail', async () => {
    for (const klic of ['resend-admin:', 'resend-user:']) {
      vi.clearAllMocks()
      db.membership.findFirst.mockResolvedValue({ id: 'm1', userId: 'u-x' })
      rl.rateLimit.mockImplementation((k: string) => !k.startsWith(klic))
      const r = await resendInvitation('m1')
      expect(r).toHaveProperty('error')
      expect(inv.createInvitation).not.toHaveBeenCalled()
      expect(inv.sendInvitationMail).not.toHaveBeenCalled()
    }
  })

  it('limit adresáta se nespotřebuje na členy cizí firmy', async () => {
    db.membership.findFirst.mockResolvedValue(null)
    await resendInvitation('m-cizi')
    expect(rl.rateLimit.mock.calls.map((c) => c[0] as string).some((k) => k.startsWith('resend-user:'))).toBe(false)
  })

  it('limity: 30/h na správce, 10/h na adresáta (jako obnova hesla)', async () => {
    await resendInvitation('m1')
    expect(rl.rateLimit).toHaveBeenCalledWith('resend-admin:u-me', 30, 3_600_000)
    expect(rl.rateLimit).toHaveBeenCalledWith('resend-user:u-x', 10, 3_600_000)
  })

  it('e-mail neodešel: ok s emailed:false', async () => {
    inv.sendInvitationMail.mockResolvedValueOnce({ emailed: false })
    expect(await resendInvitation('m1')).toEqual({ ok: true, emailed: false })
  })
})

describe('personSchema a hranice modulu', () => {
  it('normalizuje e-mail stejně jako přihlášení', () => {
    expect(personSchema.parse(vstup).email).toBe('eva@firma.cz')
  })

  it('use server soubor exportuje jen čtyři akce', () => {
    expect(Object.keys(peopleModule).sort()).toEqual(['addPerson', 'resendInvitation', 'setActive', 'setRole'])
  })
})

describe('migrace passwordSetByOwner', () => {
  it('přidá sloupec s výchozí hodnotou false a nepřepíše existující řádky na true (fail-closed)', async () => {
    const { readFileSync } = await import('node:fs')
    const sql = readFileSync('prisma/migrations/20261109140000_heslo_nastavil_majitel/migration.sql', 'utf8')
    expect(sql).toMatch(/ADD COLUMN "passwordSetByOwner" BOOLEAN NOT NULL DEFAULT false/)
    expect(sql).not.toMatch(/^\s*UPDATE\b/im)
  })
})
