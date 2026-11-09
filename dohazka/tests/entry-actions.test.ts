import { beforeEach, describe, expect, it, vi } from 'vitest'

// Akce importují server-only, org, prisma a next/cache; nahradíme je.
vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
const ctx = vi.hoisted(() => ({ user: { id: 'u1' }, membership: { id: 'm1' }, org: { id: 'o1' } }))
vi.mock('@/lib/org', () => ({ requireOrgContext: vi.fn(async () => ctx) }))
const db = vi.hoisted(() => ({
  entry: { deleteMany: vi.fn(), create: vi.fn() },
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

  it('deleteEntry bez shody (záznam jiného členství) vrací ok:false', async () => {
    db.entry.deleteMany.mockResolvedValue({ count: 0 })
    expect(await deleteEntry('cizi')).toEqual({ ok: false })
  })

  it('markDayOff maže a zakládá jen pod aktivním členstvím', async () => {
    await markDayOff('2026-11-09')
    expect(db.entry.deleteMany.mock.calls[0][0].where).toEqual({ membershipId: 'm1', day: new Date(Date.UTC(2026, 10, 9)) })
    const data = db.entry.create.mock.calls[0][0].data
    expect(data.membershipId).toBe('m1')
    expect(data).not.toHaveProperty('userId')
  })
})
