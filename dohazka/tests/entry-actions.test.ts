import { beforeEach, describe, expect, it, vi } from 'vitest'

// Akce importují server-only, org, prisma a next/cache; nahradíme je.
vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
const ctx = vi.hoisted(() => ({ user: { id: 'u1' }, membership: { id: 'm1' }, org: { id: 'o1', periodStartDay: 1 }, role: 'OWNER', isSuperAdmin: false }))
vi.mock('@/lib/org', () => ({ requireOrgContext: vi.fn(async () => ctx) }))
const db = vi.hoisted(() => ({
  entry: { deleteMany: vi.fn(), create: vi.fn(), findFirst: vi.fn() },
  periodLock: { findUnique: vi.fn() },
  $transaction: vi.fn(async (ops: unknown[]) => Promise.all(ops)),
}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))

import { deleteEntry, markDayOff, saveEntry } from '@/app/actions/entry'

function form(o: Record<string, string>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(o)) f.set(k, v)
  return f
}

// Prisma where/data objekty se porovnávají přesně: žádný klíč `userId` nesmí zbýt a membershipId musí být přesně aktivní členství.
describe('zápisy jsou omezené členstvím, ne uživatelem', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    db.entry.deleteMany.mockResolvedValue({ count: 1 })
    db.entry.create.mockResolvedValue({})
    db.entry.findFirst.mockResolvedValue({ day: new Date(Date.UTC(2026, 10, 9)) })
    db.periodLock.findUnique.mockResolvedValue(null)
  })

  it('saveEntry maže DAYOFF a zakládá záznam jen pod aktivním členstvím', async () => {
    const r = await saveEntry(form({ day: '2026-11-09', kind: 'WORK', hours: '8', place: 'Zlín' }))
    expect(r).toEqual({ ok: true })
    const where = db.entry.deleteMany.mock.calls[0][0].where
    expect(where).toEqual({ membershipId: 'm1', day: new Date(Date.UTC(2026, 10, 9)), kind: 'DAYOFF' })
    const data = db.entry.create.mock.calls[0][0].data
    expect(data.membershipId).toBe('m1')
    expect(data).not.toHaveProperty('userId')
  })

  it('deleteEntry maže cizí id jen v rámci aktivního členství', async () => {
    await deleteEntry('e42')
    expect(db.entry.deleteMany).toHaveBeenCalledWith({ where: { id: 'e42', membershipId: 'm1' } })
  })

  it('deleteEntry bez shody (záznam jiného členství) vrací chybu a nemaže', async () => {
    db.entry.findFirst.mockResolvedValue(null)
    expect(await deleteEntry('cizi')).toEqual({ error: 'Smazání se nepodařilo.' })
    expect(db.entry.findFirst).toHaveBeenCalledWith({ where: { id: 'cizi', membershipId: 'm1' }, select: { day: true } })
    expect(db.entry.deleteMany).not.toHaveBeenCalled()
  })

  it('markDayOff maže a zakládá jen pod aktivním členstvím', async () => {
    await markDayOff('2026-11-09')
    expect(db.entry.deleteMany.mock.calls[0][0].where).toEqual({ membershipId: 'm1', day: new Date(Date.UTC(2026, 10, 9)) })
    const data = db.entry.create.mock.calls[0][0].data
    expect(data.membershipId).toBe('m1')
    expect(data).not.toHaveProperty('userId')
  })
})

// Uzávěrka platí na všechny včetně správce a super admina a hlídá ji akce, ne stránka.
describe('uzavřené období neprojde žádnou akcí dne', () => {
  const HLASKA = 'Měsíc je uzavřený, zápis už nejde změnit.'
  const zadnyZapis = () => {
    expect(db.entry.create).not.toHaveBeenCalled()
    expect(db.entry.deleteMany).not.toHaveBeenCalled()
    expect(db.$transaction).not.toHaveBeenCalled()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    db.entry.deleteMany.mockResolvedValue({ count: 1 })
    db.entry.create.mockResolvedValue({})
    db.entry.findFirst.mockResolvedValue({ day: new Date(Date.UTC(2026, 10, 9)) })
    db.periodLock.findUnique.mockResolvedValue({ id: 'l1' })
    ctx.org.periodStartDay = 1
  })

  it('saveEntry: chyba a žádný zápis', async () => {
    expect(await saveEntry(form({ day: '2026-11-09', kind: 'WORK', hours: '8', place: 'Zlín' }))).toEqual({ error: HLASKA })
    zadnyZapis()
  })

  it('deleteEntry: chyba a žádný zápis', async () => {
    expect(await deleteEntry('e1')).toEqual({ error: HLASKA })
    zadnyZapis()
  })

  it('markDayOff: chyba a žádný zápis', async () => {
    expect(await markDayOff('2026-11-09')).toEqual({ error: HLASKA })
    zadnyZapis()
  })

  it('čte se jen jedno období firmy, ne seznam', async () => {
    await saveEntry(form({ day: '2026-11-09', kind: 'WORK', hours: '8', place: 'Zlín' }))
    expect(db.periodLock.findUnique).toHaveBeenCalledTimes(1)
    expect(db.periodLock.findUnique.mock.calls[0][0].where).toEqual({ orgId_periodKey: { orgId: 'o1', periodKey: '2026-11' } })
  })

  it('uzávěrka ctí periodStartDay firmy: při 16 patří 20. 11. do období 2026-12', async () => {
    ctx.org.periodStartDay = 16
    await markDayOff('2026-11-20')
    expect(db.periodLock.findUnique.mock.calls[0][0].where.orgId_periodKey.periodKey).toBe('2026-12')
    db.periodLock.findUnique.mockClear()
    await markDayOff('2026-11-15')
    expect(db.periodLock.findUnique.mock.calls[0][0].where.orgId_periodKey.periodKey).toBe('2026-11')
  })

  it('super admin uzávěrku neobejde', async () => {
    ctx.isSuperAdmin = true
    try {
      expect(await markDayOff('2026-11-09')).toEqual({ error: HLASKA })
      zadnyZapis()
    } finally {
      ctx.isSuperAdmin = false
    }
  })

  it('otevřené období zapisuje normálně', async () => {
    db.periodLock.findUnique.mockResolvedValue(null)
    expect(await markDayOff('2026-11-09')).toEqual({ ok: true })
    expect(db.entry.create).toHaveBeenCalledTimes(1)
  })
})
