import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Skutečné requireSuperAdmin (z org.ts) zůstává; nahrazujeme jen okolí: přihlášení, Next a databázi.
// Díky tomu test spadne, i když akce kontrolu super admina vynechá nebo nahradí vlastní.
vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({ cookies: vi.fn() }))
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
  organization: { create: vi.fn() },
  membership: { create: vi.fn() },
  $transaction: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
const inv = vi.hoisted(() => ({ createInvitation: vi.fn(), sendInvitationMail: vi.fn(), notifyAddedToOrg: vi.fn() }))
vi.mock('@/lib/invitation', () => inv)

import { createOrganization } from '@/app/actions/org'
import { orgSchema } from '@/lib/validation'
import * as orgActionsModule from '@/app/actions/org'

const vstup = { name: 'Truhlářství Novák', reportName: 'Truhlářství Novák s.r.o.', ownerEmail: 'Jan@Novak.cz', ownerName: 'Jan Novák' }

function zapisy() {
  return db.user.create.mock.calls.length + db.user.update.mock.calls.length + db.organization.create.mock.calls.length + db.membership.create.mock.calls.length
}

beforeEach(() => {
  vi.clearAllMocks()
  auth.requireUser.mockResolvedValue({ id: 'sa', isSuperAdmin: true })
  // Transakce: nejdřív se záznamy sbírají do „tx“ (stejné mocky), po chybě se nic nepotvrdí.
  db.$transaction.mockImplementation(async (fn: (tx: typeof db) => unknown) => fn(db))
  db.user.findUnique.mockResolvedValue(null)
  db.user.create.mockResolvedValue({ id: 'u-new' })
  db.organization.create.mockResolvedValue({ id: 'o-new' })
  db.membership.create.mockResolvedValue({ id: 'm-new' })
  db.user.updateMany.mockResolvedValue({ count: 1 })
  inv.createInvitation.mockResolvedValue('tok')
  inv.sendInvitationMail.mockResolvedValue({ emailed: true })
  inv.notifyAddedToOrg.mockResolvedValue(true)
})

describe('createOrganization: oprávnění', () => {
  it('běžný uživatel (i správce firmy) nezpůsobí žádný zápis ani transakci', async () => {
    auth.requireUser.mockResolvedValue({ id: 'u1', isSuperAdmin: false })
    await expect(createOrganization(vstup)).rejects.toThrow('NEXT_REDIRECT:/')
    expect(db.$transaction).not.toHaveBeenCalled()
    expect(zapisy()).toBe(0)
    expect(db.user.findUnique).not.toHaveBeenCalled()
  })

  it('nepřihlášený nezpůsobí žádný zápis', async () => {
    auth.requireUser.mockImplementation(async () => {
      throw new Error('NEXT_REDIRECT:/prihlaseni')
    })
    await expect(createOrganization(vstup)).rejects.toThrow('NEXT_REDIRECT:/prihlaseni')
    expect(db.$transaction).not.toHaveBeenCalled()
    expect(zapisy()).toBe(0)
  })

  it('kontrola proběhne dřív než validace: neplatný vstup od cizího nic neprozradí', async () => {
    auth.requireUser.mockResolvedValue({ id: 'u1', isSuperAdmin: false })
    await expect(createOrganization({ ...vstup, name: '' })).rejects.toThrow('NEXT_REDIRECT:/')
  })
})

describe('createOrganization: nová firma a první správce', () => {
  it('firma a členství OWNER vznikají v jedné transakci, nikdy mimo ni', async () => {
    const r = await createOrganization(vstup)
    expect(r).toMatchObject({ ok: true, orgId: 'o-new' })
    expect(db.$transaction).toHaveBeenCalledTimes(1)
    // Všechny zápisy proběhly uvnitř callbacku transakce, ne před ní ani po ní.
    expect(db.organization.create).toHaveBeenCalledTimes(1)
    expect(db.membership.create).toHaveBeenCalledTimes(1)
    const data = db.membership.create.mock.calls[0][0].data
    expect(data).toMatchObject({ userId: 'u-new', orgId: 'o-new', role: 'OWNER', active: true })
    // Název firmy a název ve výkazu jsou dvě různé hodnoty a nesmí se zaměnit.
    expect(db.organization.create.mock.calls[0][0].data).toEqual({ name: 'Truhlářství Novák', reportName: 'Truhlářství Novák s.r.o.' })
  })

  describe('tracksFrom je pražský den, ne UTC', () => {
    // 23:30 UTC 8. 11. je v Praze (CET) už 0:30 dne 9. 11.; UTC den by byl o den dřív.
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-11-08T23:30:00Z'))
    })
    afterEach(() => vi.useRealTimers())

    it('nový správce', async () => {
      await createOrganization(vstup)
      expect(db.membership.create.mock.calls[0][0].data.tracksFrom).toEqual(new Date(Date.UTC(2026, 10, 9)))
    })

    it('připojený existující uživatel', async () => {
      db.user.findUnique.mockResolvedValue({ id: 'u-old', passwordSetByOwner: true })
      await createOrganization(vstup)
      expect(db.membership.create.mock.calls[0][0].data.tracksFrom).toEqual(new Date(Date.UTC(2026, 10, 9)))
    })
  })

  it('zápisy jdou přes klienta transakce, ne přes globální prisma', async () => {
    const tx = {
      user: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: 'u2' }), update: vi.fn() },
      organization: { create: vi.fn().mockResolvedValue({ id: 'o2' }) },
      membership: { create: vi.fn().mockResolvedValue({ id: 'm2' }) },
    }
    db.$transaction.mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx))
    await createOrganization(vstup)
    expect(tx.organization.create).toHaveBeenCalledTimes(1)
    expect(tx.membership.create).toHaveBeenCalledTimes(1)
    expect(db.organization.create).not.toHaveBeenCalled()
    expect(db.membership.create).not.toHaveBeenCalled()
    expect(db.user.create).not.toHaveBeenCalled()
  })

  it('když selže členství, akce vrátí chybu a transakce se nedokončí (skutečný rollback řeší Prisma, mock ho neověří)', async () => {
    // Mock jen zaznamená, že callback transakce doběhl; skutečné vrácení zápisů dělá Prisma při výjimce z callbacku.
    const potvrzeno: string[] = []
    db.$transaction.mockImplementation(async (fn: (t: typeof db) => Promise<unknown>) => {
      const r = await fn(db)
      potvrzeno.push('commit')
      return r
    })
    db.membership.create.mockRejectedValue(new Error('db spadla'))
    const r = await createOrganization(vstup)
    expect(r).toHaveProperty('error')
    expect(potvrzeno).toEqual([])
  })

  it('nový účet dostane vygenerované heslo a hash; heslo se vrací jen jednou', async () => {
    const r = await createOrganization(vstup)
    expect(r).toMatchObject({ ok: true })
    const heslo = (r as { password?: string }).password
    expect(heslo).toMatch(/^[A-Za-z0-9]{16}$/)
    const data = db.user.create.mock.calls[0][0].data
    expect(data.email).toBe('jan@novak.cz') // e-mail se normalizuje
    expect(data.name).toBe('Jan Novák')
    expect(data.passwordHash).toMatch(/^\$2[aby]\$/)
    expect(data.passwordHash).not.toContain(heslo)
    expect(data.isSuperAdmin).not.toBe(true)
  })

  it('funguje i na prázdné databázi: žádná firma neexistuje, nic se nehledá', async () => {
    // Nikde se nečte Organization; bootstrap první firmy nesmí záviset na existujících datech.
    const r = await createOrganization(vstup)
    expect(r).toMatchObject({ ok: true })
  })
})

describe('createOrganization: existující e-mail', () => {
  beforeEach(() => {
    db.user.findUnique.mockResolvedValue({ id: 'u-old', passwordSetByOwner: true })
  })

  it('připojí existujícího uživatele: nevznikne druhý účet a nic se mu nepřepíše', async () => {
    const r = await createOrganization(vstup)
    expect(r).toMatchObject({ ok: true, orgId: 'o-new' })
    expect(db.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { email: 'jan@novak.cz' } }))
    expect(db.user.create).not.toHaveBeenCalled()
    expect(db.user.update).not.toHaveBeenCalled() // heslo, jméno ani příznak se nemění
    expect(db.membership.create.mock.calls[0][0].data).toMatchObject({ userId: 'u-old', orgId: 'o-new', role: 'OWNER' })
  })

  it('u existujícího účtu se heslo nevrací (žádné nebylo vytvořeno)', async () => {
    const r = await createOrganization(vstup)
    expect(r).not.toHaveProperty('password')
  })

  it('jiné členství té osoby se nemění: zapisuje se jediné nové', async () => {
    await createOrganization(vstup)
    expect(db.membership.create).toHaveBeenCalledTimes(1)
    expect(db.session.deleteMany).not.toHaveBeenCalled()
  })
})

describe('createOrganization: existující e-mail s heslem, které zná cizí správce', () => {
  beforeEach(() => {
    db.user.findUnique.mockResolvedValue({ id: 'u-old', passwordSetByOwner: false })
  })

  it('heslo se v téže transakci přepíše na náhodné, relace se zruší, vznikne členství OWNER a řádek pozvánky; commit až nakonec', async () => {
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
    await createOrganization({ ...vstup, delivery: 'password' })
    expect(poradi).toEqual(['update', 'sessions', 'membership', 'invitation', 'commit', 'mail'])
    const upd = db.user.updateMany.mock.calls[0][0]
    // Podmínka passwordSetByOwner: false je zámek proti souběhu s consumeInvitation.
    expect(upd.where).toEqual({ id: 'u-old', passwordSetByOwner: false })
    expect(Object.keys(upd.data)).toEqual(['passwordHash'])
    expect(upd.data.passwordHash).toMatch(/^\$2[aby]\$/)
    expect(db.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u-old' } })
    expect(db.membership.create.mock.calls[0][0].data).toMatchObject({ userId: 'u-old', role: 'OWNER' })
  })

  it('souběh: majitel si mezitím nastavil vlastní heslo (updateMany count 0) - nic se nepřepíše, relace zůstanou, jen informační e-mail', async () => {
    db.user.updateMany.mockResolvedValue({ count: 0 })
    const r = await createOrganization(vstup)
    expect(db.session.deleteMany).not.toHaveBeenCalled()
    expect(inv.createInvitation).not.toHaveBeenCalled()
    expect(inv.notifyAddedToOrg).toHaveBeenCalledTimes(1)
    expect(r).toEqual({ ok: true, orgId: 'o-new', existing: { emailed: true } })
  })

  it('super admin nedostane heslo (ani při volbě "heslo", ani když e-mail neodešel); odejde pozvánka', async () => {
    const r = await createOrganization({ ...vstup, delivery: 'password' })
    expect(r).toEqual({ ok: true, orgId: 'o-new', existing: { emailed: true } })
    expect(inv.createInvitation).toHaveBeenCalledWith({ userId: 'u-old', membershipId: 'm-new', kind: 'invite' }, db)
    expect(inv.sendInvitationMail).toHaveBeenCalledWith({ userId: 'u-old', membershipId: 'm-new', kind: 'invite', token: 'tok' })
    inv.sendInvitationMail.mockResolvedValueOnce({ emailed: false })
    expect(await createOrganization(vstup)).not.toHaveProperty('password')
  })

  it('odpověď pro existující účet je stejná bez ohledu na příznak', async () => {
    const a = await createOrganization(vstup)
    db.user.findUnique.mockResolvedValue({ id: 'u-old', passwordSetByOwner: true })
    const b = await createOrganization(vstup)
    expect(a).toEqual(b)
  })

  it('s příznakem true se účet nechá být a odejde jen informační e-mail', async () => {
    db.user.findUnique.mockResolvedValue({ id: 'u-old', passwordSetByOwner: true })
    await createOrganization(vstup)
    expect(db.user.update).not.toHaveBeenCalled()
    expect(db.user.updateMany).not.toHaveBeenCalled()
    expect(db.session.deleteMany).not.toHaveBeenCalled()
    expect(inv.createInvitation).not.toHaveBeenCalled()
    expect(inv.sendInvitationMail).not.toHaveBeenCalled()
    expect(inv.notifyAddedToOrg).toHaveBeenCalledWith('u-old', 'Truhlářství Novák')
  })

  it('nový účet se zneplatnění netýká', async () => {
    db.user.findUnique.mockResolvedValue(null)
    await createOrganization(vstup)
    expect(db.user.updateMany).not.toHaveBeenCalled()
    expect(db.session.deleteMany).not.toHaveBeenCalled()
  })
})

describe('createOrganization: validace', () => {
  it.each([
    ['prázdný název', { name: '   ' }],
    ['dlouhý název', { name: 'x'.repeat(121) }],
    ['prázdný název ve výkazu', { reportName: '' }],
    ['špatný e-mail', { ownerEmail: 'neni-email' }],
    ['prázdné jméno', { ownerName: '  ' }],
  ])('%s: chyba a žádný zápis', async (_n, zmena) => {
    const r = await createOrganization({ ...vstup, ...zmena })
    expect(r).toHaveProperty('error')
    expect(db.$transaction).not.toHaveBeenCalled()
    expect(zapisy()).toBe(0)
  })

  it('orgSchema ořezává mezery a zmenšuje e-mail', () => {
    const v = orgSchema.parse({ ...vstup, name: '  Firma  ' })
    expect(v.name).toBe('Firma')
    expect(v.ownerEmail).toBe('jan@novak.cz')
  })
})

describe('createOrganization: pozvánka místo hesla', () => {
  const pozvat = { ...vstup, delivery: 'invite' as const }

  it('nový správce: heslo se nevrací a pozvánka míří na jeho účet a členství', async () => {
    const r = await createOrganization(pozvat)
    expect(r).toEqual({ ok: true, orgId: 'o-new', invite: { emailed: true, created: true } })
    expect(r).not.toHaveProperty('password')
    expect(inv.createInvitation).toHaveBeenCalledWith({ userId: 'u-new', membershipId: 'm-new', kind: 'invite' }, db)
    expect(inv.sendInvitationMail).toHaveBeenCalledWith({ userId: 'u-new', membershipId: 'm-new', kind: 'invite', token: 'tok' })
  })

  it('pozvánka se vytváří až po potvrzení transakce', async () => {
    const poradi: string[] = []
    db.$transaction.mockImplementation(async (fn: (t: typeof db) => Promise<unknown>) => {
      const r = await fn(db)
      poradi.push('commit')
      return r
    })
    inv.sendInvitationMail.mockImplementation(async () => {
      poradi.push('pozvanka')
      return { emailed: true }
    })
    await createOrganization(pozvat)
    expect(poradi).toEqual(['commit', 'pozvanka'])
  })

  it('e-mail neodešel: správce nezůstane zamčený, vrací se heslo (původní chování) a výsledek to říká', async () => {
    inv.sendInvitationMail.mockResolvedValue({ emailed: false })
    const r = await createOrganization(pozvat)
    expect(r).toMatchObject({ ok: true, orgId: 'o-new', invite: { emailed: false, created: true } })
    const heslo = (r as { password?: string }).password
    expect(heslo).toMatch(/^[A-Za-z0-9]{16}$/)
    // Vrácené heslo je opravdu to uložené v účtu.
    const { verifyPassword } = await import('@/lib/crypto')
    expect(await verifyPassword(heslo!, db.user.create.mock.calls[0][0].data.passwordHash)).toBe(true)
  })

  it('řádek pozvánky vzniká UVNITŘ transakce; selže-li, vrátí se celá (firma ani správce bez pozvánky nezůstanou)', async () => {
    const potvrzeno: string[] = []
    db.$transaction.mockImplementation(async (fn: (t: typeof db) => Promise<unknown>) => {
      const r = await fn(db)
      potvrzeno.push('commit')
      return r
    })
    inv.createInvitation.mockRejectedValue(new Error('db spadla'))
    const r = await createOrganization(pozvat)
    expect(r).toHaveProperty('error')
    expect(r).not.toHaveProperty('password')
    expect(potvrzeno).toEqual([])
    expect(inv.sendInvitationMail).not.toHaveBeenCalled()
  })

  it('createInvitation dostane klienta TRANSAKCE (druhý argument), ne globální prisma', async () => {
    const tx = {
      user: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: 'u2' }), update: vi.fn(), updateMany: vi.fn() },
      session: { deleteMany: vi.fn() },
      organization: { create: vi.fn().mockResolvedValue({ id: 'o2' }) },
      membership: { create: vi.fn().mockResolvedValue({ id: 'm2' }) },
    }
    db.$transaction.mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx))
    await createOrganization(pozvat)
    expect(inv.createInvitation.mock.calls[0][1]).toBe(tx)
  })

  it('existující účet s vlastním heslem se nezvoucí, jen se mu pošle informace', async () => {
    db.user.findUnique.mockResolvedValue({ id: 'u-old', passwordSetByOwner: true })
    const r = await createOrganization(pozvat)
    expect(r).toEqual({ ok: true, orgId: 'o-new', existing: { emailed: true } })
    expect(inv.createInvitation).not.toHaveBeenCalled()
    expect(inv.sendInvitationMail).not.toHaveBeenCalled()
  })

  it('bez volby (nebo delivery: password) zůstává původní chování s heslem a bez pozvánky', async () => {
    for (const d of [{}, { delivery: 'password' as const }]) {
      inv.sendInvitationMail.mockClear()
      const r = await createOrganization({ ...vstup, ...d })
      expect((r as { password?: string }).password).toMatch(/^[A-Za-z0-9]{16}$/)
      expect(inv.createInvitation).not.toHaveBeenCalled()
    expect(inv.sendInvitationMail).not.toHaveBeenCalled()
    }
  })

  it('neznámá hodnota volby je chyba bez zápisu', async () => {
    const r = await createOrganization({ ...vstup, delivery: 'sms' } as never)
    expect(r).toHaveProperty('error')
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it('běžný uživatel pozvánku nevyvolá', async () => {
    auth.requireUser.mockResolvedValue({ id: 'u1', isSuperAdmin: false })
    await expect(createOrganization(pozvat)).rejects.toThrow('NEXT_REDIRECT:/')
    expect(inv.createInvitation).not.toHaveBeenCalled()
    expect(inv.sendInvitationMail).not.toHaveBeenCalled()
  })
})

describe("soubor s 'use server'", () => {
  it('exportuje jen akce createOrganization a updateOrgSettings (každý export je veřejně volatelná akce)', () => {
    expect(Object.keys(orgActionsModule).sort()).toEqual(['createOrganization', 'updateOrgSettings'])
  })
})
