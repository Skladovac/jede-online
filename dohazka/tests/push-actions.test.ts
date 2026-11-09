import { beforeEach, describe, expect, it, vi } from 'vitest'

// Akce importují server-only, auth, prisma a next/cache; nahradíme je.
vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/org', () => ({ requireOrgContext: vi.fn(async () => ({ user: { id: 'u1' }, membership: { id: 'm1' } })) }))
const db = vi.hoisted(() => ({ deleteMany: vi.fn(), upsert: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: { pushSubscription: db } }))

import { removePushSubscription, savePushSubscription } from '@/app/actions/push'

describe('removePushSubscription', () => {
  beforeEach(() => vi.clearAllMocks())

  it('maže jen odběr přihlášeného uživatele (nikdy podle samotného endpointu)', async () => {
    db.deleteMany.mockResolvedValue({ count: 1 })
    await removePushSubscription('https://fcm.googleapis.com/fcm/send/abc')
    expect(db.deleteMany).toHaveBeenCalledWith({ where: { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', userId: 'u1' } })
  })

  it('prázdný nebo příliš dlouhý endpoint nezpracuje', async () => {
    expect(await removePushSubscription('')).toEqual({ ok: false })
    expect(await removePushSubscription('https://fcm.googleapis.com/' + 'a'.repeat(1000))).toEqual({ ok: false })
    expect(db.deleteMany).not.toHaveBeenCalled()
  })
})

describe('savePushSubscription', () => {
  beforeEach(() => vi.clearAllMocks())
  const ok = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'k', auth: 'a' } }

  it('uloží platný odběr k přihlášenému uživateli', async () => {
    expect(await savePushSubscription(ok)).toEqual({ ok: true })
    expect(db.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ userId: 'u1' }) }))
  })

  it.each([
    ['cizí endpoint', { ...ok, endpoint: 'https://evil.example.com/x' }],
    ['chybějící klíče', { endpoint: ok.endpoint }],
    ['dlouhý klíč auth', { ...ok, keys: { p256dh: 'k', auth: 'a'.repeat(101) } }],
    ['null', null],
  ])('odmítne %s', async (_n, sub) => {
    expect(await savePushSubscription(sub)).toEqual({ ok: false })
    expect(db.upsert).not.toHaveBeenCalled()
  })
})
