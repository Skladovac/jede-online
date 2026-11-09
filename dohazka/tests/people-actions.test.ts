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
  user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  membership: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
  $transaction: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
const inv = vi.hoisted(() => ({ inviteByMail: vi.fn() }))
vi.mock('@/lib/invitation', () => inv)

import { addPerson, setActive, setRole } from '@/app/actions/people'
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
  inv.inviteByMail.mockResolvedValue({ emailed: true })
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
    expect(inv.inviteByMail).toHaveBeenCalledWith({ userId: 'u-new', membershipId: 'm-new', kind: 'invite' })
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
    inv.inviteByMail.mockImplementation(async () => {
      poradi.push('invite')
      return { emailed: true }
    })
    await addPerson({ ...vstup, delivery: 'invite' })
    expect(poradi).toEqual(['commit', 'invite'])
  })

  it('e-mail neodešel: vrátí vygenerované heslo (hash v databázi, ne heslo)', async () => {
    inv.inviteByMail.mockResolvedValue({ emailed: false })
    const r = (await addPerson({ ...vstup, delivery: 'invite' })) as { password?: string; invite?: unknown }
    expect(r.password).toMatch(/^[A-Za-z0-9]{16}$/)
    expect(r.invite).toEqual({ emailed: false, created: true })
    const hash = db.user.create.mock.calls[0][0].data.passwordHash
    expect(hash).toMatch(/^\$2[aby]\$/)
    expect(hash).not.toContain(r.password)
  })

  it('pozvánku nejde vytvořit (výjimka): také vrátí heslo a členství zůstává', async () => {
    inv.inviteByMail.mockRejectedValue(new Error('db'))
    const r = (await addPerson({ ...vstup, delivery: 'invite' })) as { password?: string; invite?: unknown }
    expect(r.password).toMatch(/^[A-Za-z0-9]{16}$/)
    expect(r.invite).toEqual({ emailed: false, created: false })
  })

  it('volba "heslo": vrátí heslo a nic nepošle', async () => {
    const r = (await addPerson({ ...vstup, delivery: 'password' })) as { password?: string }
    expect(r.password).toMatch(/^[A-Za-z0-9]{16}$/)
    expect(inv.inviteByMail).not.toHaveBeenCalled()
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

describe('addPerson: existující e-mail', () => {
  beforeEach(() => {
    db.user.findUnique.mockResolvedValue({ id: 'u-old' })
  })

  it('připojí existující účet: žádný nový uživatel, žádný zápis do uživatele (heslo, jméno)', async () => {
    const r = await addPerson({ ...vstup, name: 'Jiné jméno', delivery: 'password' })
    expect(r).toEqual({ ok: true, attached: true })
    expect(db.user.create).not.toHaveBeenCalled()
    expect(db.user.update).not.toHaveBeenCalled()
    expect(db.membership.create).toHaveBeenCalledTimes(1)
    expect(db.membership.create.mock.calls[0][0].data).toMatchObject({ userId: 'u-old', orgId: 'o1', role: 'EMPLOYEE' })
  })

  it('nevrací heslo, ani když je zvolená volba "heslo", a nepošle pozvánku', async () => {
    const r = await addPerson({ ...vstup, delivery: 'password' })
    expect(r).not.toHaveProperty('password')
    const r2 = await addPerson({ ...vstup, delivery: 'invite' })
    expect(r2).not.toHaveProperty('password')
    expect(inv.inviteByMail).not.toHaveBeenCalled()
  })

  it('už je členem téhle firmy (i neaktivní): chyba, žádný zápis, hledá se jen v této firmě', async () => {
    db.membership.findFirst.mockResolvedValue({ id: 'm-x' })
    const r = await addPerson(vstup)
    expect(r).toHaveProperty('error')
    expect(zapisy()).toBe(0)
    expect(db.membership.findFirst.mock.calls[0][0].where).toEqual({ userId: 'u-old', orgId: 'o1' })
  })
})

describe('personSchema a hranice modulu', () => {
  it('normalizuje e-mail stejně jako přihlášení', () => {
    expect(personSchema.parse(vstup).email).toBe('eva@firma.cz')
  })

  it('use server soubor exportuje jen tři akce', () => {
    expect(Object.keys(peopleModule).sort()).toEqual(['addPerson', 'setActive', 'setRole'])
  })
})
