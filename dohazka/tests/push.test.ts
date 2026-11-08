import { beforeEach, describe, expect, it, vi } from 'vitest'

// push.ts importuje server-only, prisma a web-push; pro testy je nahradíme.
vi.mock('server-only', () => ({}))
const db = vi.hoisted(() => ({ findMany: vi.fn(), deleteMany: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: { pushSubscription: db } }))
const wp = vi.hoisted(() => ({ setVapidDetails: vi.fn(), sendNotification: vi.fn() }))
vi.mock('web-push', () => ({ default: wp }))

import { isPushEndpoint } from '@/lib/push'

describe('isPushEndpoint', () => {
  it('pustí jen skutečné push služby prohlížečů', () => {
    expect(isPushEndpoint('https://web.push.apple.com/abc')).toBe(true)
    expect(isPushEndpoint('https://fcm.googleapis.com/fcm/send/abc')).toBe(true)
    expect(isPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/abc')).toBe(true)
  })
  it('odmítne cokoli, co by server donutilo zavolat domů nebo jinam', () => {
    for (const bad of [
      'http://web.push.apple.com/abc',
      'https://web.push.apple.com:8443/abc',
      'https://user:pw@web.push.apple.com/abc',
      'https://127.0.0.1/abc',
      'https://localhost/abc',
      'https://evil.example.com/abc',
      'https://web.push.apple.com.evil.example.com/abc',
      'not-a-url',
      '',
    ]) {
      expect(isPushEndpoint(bad), bad).toBe(false)
    }
  })
})

describe('sendPush', () => {
  const sub = (id: string, endpoint = 'https://fcm.googleapis.com/fcm/send/' + id) => ({ id, endpoint, p256dh: 'k', auth: 'a' })
  // Stav „VAPID klíče nastaveny“ si modul pamatuje, proto pokaždé čistý import.
  const fresh = async () => (await import('@/lib/push')).sendPush

  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
    vi.useRealTimers()
    vi.resetModules()
  })

  it('bez VAPID klíčů nic neodešle a nevyhodí chybu', async () => {
    vi.stubEnv('VAPID_PUBLIC_KEY', '')
    vi.stubEnv('VAPID_PRIVATE_KEY', '')
    expect(await (await fresh())('u1', { title: 'x' })).toEqual({ sent: 0, skipped: 'no-keys' })
    expect(db.findMany).not.toHaveBeenCalled()
  })

  describe('s klíči', () => {
    beforeEach(() => {
      vi.stubEnv('VAPID_PUBLIC_KEY', 'pub')
      vi.stubEnv('VAPID_PRIVATE_KEY', 'priv')
    })

    it('hledá odběry jen daného uživatele a pípne i v noci (žádný noční klid)', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-11-08T02:30:00Z')) // 3:30 v Praze
      db.findMany.mockResolvedValue([sub('s1'), sub('s2')])
      wp.sendNotification.mockResolvedValue({})
      expect(await (await fresh())('u1', { title: 'Připomínka', url: '/den/2026-11-08' })).toEqual({ sent: 2 })
      expect(db.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'u1' } }))
      expect(JSON.parse(wp.sendNotification.mock.calls[0][1])).toMatchObject({ title: 'Připomínka', url: '/den/2026-11-08' })
    })

    it('cizí adresu v URL nahradí kořenem', async () => {
      db.findMany.mockResolvedValue([sub('s1')])
      wp.sendNotification.mockResolvedValue({})
      await (await fresh())('u1', { title: 'x', url: 'https://evil.example.com' })
      expect(JSON.parse(wp.sendNotification.mock.calls[0][1]).url).toBe('/')
    })

    it('neposílá na endpoint, který není push služba', async () => {
      db.findMany.mockResolvedValue([sub('s1', 'https://127.0.0.1/x')])
      expect(await (await fresh())('u1', { title: 'x' })).toEqual({ sent: 0 })
      expect(wp.sendNotification).not.toHaveBeenCalled()
    })

    it('odběr s 410 smaže (jen u téhož uživatele), jiná chyba ho nechá', async () => {
      db.findMany.mockResolvedValue([sub('gone'), sub('flaky')])
      db.deleteMany.mockResolvedValue({ count: 1 })
      wp.sendNotification.mockImplementation(async (s: { endpoint: string }) => {
        throw Object.assign(new Error('x'), { statusCode: s.endpoint.endsWith('gone') ? 410 : 500 })
      })
      const err = vi.spyOn(console, 'error').mockImplementation(() => {})
      expect(await (await fresh())('u1', { title: 'x' })).toEqual({ sent: 0 })
      expect(db.deleteMany).toHaveBeenCalledTimes(1)
      expect(db.deleteMany).toHaveBeenCalledWith({ where: { id: 'gone', userId: 'u1' } })
      err.mockRestore()
    })

    it('chyba databáze se nepropíše ven', async () => {
      db.findMany.mockRejectedValue(new Error('db'))
      const err = vi.spyOn(console, 'error').mockImplementation(() => {})
      expect(await (await fresh())('u1', { title: 'x' })).toEqual({ sent: 0, skipped: 'error' })
      err.mockRestore()
    })
  })
})
