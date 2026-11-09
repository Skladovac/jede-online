import { describe, expect, it, vi } from 'vitest'

// rate-limit.ts importuje server-only a next/headers; pro testy čisté logiky je nahradíme.
vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))

const { clearRateLimit, rateLimit } = await import('@/lib/rate-limit')

describe('rateLimit / clearRateLimit', () => {
  it('po vyčerpání limitu vrací false, po clearRateLimit zase true', () => {
    for (let i = 0; i < 3; i++) expect(rateLimit('t:a', 3, 60_000)).toBe(true)
    expect(rateLimit('t:a', 3, 60_000)).toBe(false)
    clearRateLimit('t:a')
    expect(rateLimit('t:a', 3, 60_000)).toBe(true)
  })
  it('nulování jednoho klíče nesahá na jiný', () => {
    for (let i = 0; i < 2; i++) rateLimit('t:b', 2, 60_000)
    for (let i = 0; i < 2; i++) rateLimit('t:c', 2, 60_000)
    clearRateLimit('t:b')
    expect(rateLimit('t:b', 2, 60_000)).toBe(true)
    expect(rateLimit('t:c', 2, 60_000)).toBe(false)
  })
  it('nulování neexistujícího klíče nic nerozbije', () => {
    expect(() => clearRateLimit('t:nikdy')).not.toThrow()
  })
})
