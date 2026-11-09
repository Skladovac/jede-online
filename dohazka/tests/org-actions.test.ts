import { beforeEach, describe, expect, it, vi } from 'vitest'

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
  user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  organization: { create: vi.fn() },
  membership: { create: vi.fn() },
  $transaction: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))

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
    expect(data.tracksFrom).toBeInstanceOf(Date)
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

  it('když selže členství, firma se nepotvrdí: transakce propadne a akce vrátí chybu', async () => {
    // Skutečná transakce vrací zpět vše; simulujeme to tím, že potvrzení (návrat z callbacku) nenastane.
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
    db.user.findUnique.mockResolvedValue({ id: 'u-old' })
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

describe("soubor s 'use server'", () => {
  it('exportuje jen createOrganization (každý export je veřejně volatelná akce)', () => {
    expect(Object.keys(orgActionsModule).sort()).toEqual(['createOrganization'])
  })
})
