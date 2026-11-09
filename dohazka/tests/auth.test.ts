import { describe, expect, it, vi } from 'vitest'

// Kryptografie a schéma se testují doopravdy; nahrazuje se jen okolí, aby šel importovat modul akcí
// (kvůli seznamu jeho exportů — v souboru s 'use server' je každý export veřejný endpoint).
vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => ({ get: () => undefined, set: vi.fn(), delete: vi.fn() })) }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: vi.fn() }, session: { create: vi.fn(), deleteMany: vi.fn() } } }))

import { hashPassword, sha256, verifyPassword } from '@/lib/crypto'
import { loginSchema } from '@/lib/validation'
import * as authModule from '@/app/actions/auth'

describe('hesla', () => {
  it('ověří správné a odmítne špatné', async () => {
    const hash = await hashPassword('tajne-heslo-123')
    expect(await verifyPassword('tajne-heslo-123', hash)).toBe(true)
    expect(await verifyPassword('tajne-heslo-124', hash)).toBe(false)
  })
  it('hash není heslo', async () => {
    expect(await hashPassword('abc')).not.toContain('abc')
  })
})

describe('sha256', () => {
  it('je stabilní a 64 znaků', () => {
    expect(sha256('token')).toBe(sha256('token'))
    expect(sha256('token')).toHaveLength(64)
    expect(sha256('a')).not.toBe(sha256('b'))
  })
})

describe('loginSchema', () => {
  it('vezme platný e-mail a heslo', () => {
    expect(loginSchema.safeParse({ email: 'a@b.cz', password: 'heslo1234' }).success).toBe(true)
  })
  it('normalizuje e-mail (mezery, velikost písmen)', () => {
    expect(loginSchema.parse({ email: ' A@B.CZ ', password: 'heslo1234' }).email).toBe('a@b.cz')
  })
  it('odmítne nesmysl', () => {
    expect(loginSchema.safeParse({ email: 'neni-email', password: 'heslo1234' }).success).toBe(false)
    expect(loginSchema.safeParse({ email: 'a@b.cz', password: '' }).success).toBe(false)
  })
})

describe("soubor s 'use server'", () => {
  it('exportuje jen login a logout (každý export je veřejně volatelný endpoint)', () => {
    expect(Object.keys(authModule).sort()).toEqual(['login', 'logout'])
  })
})
