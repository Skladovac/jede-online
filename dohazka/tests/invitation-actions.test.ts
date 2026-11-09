import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const ip = vi.hoisted(() => ({ value: '1.1.1.1' }))
vi.mock('next/headers', () => ({ cookies: vi.fn(), headers: async () => ({ get: (n: string) => (n === 'x-real-ip' ? ip.value : null) }) }))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`)
  }),
}))
const db = vi.hoisted(() => ({ user: { findUnique: vi.fn() } }))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
const inv = vi.hoisted(() => ({ inviteByMail: vi.fn(), consumeInvitation: vi.fn() }))
vi.mock('@/lib/invitation', () => inv)

import { requestPasswordReset, setPassword } from '@/app/actions/invitation'
import * as modul from '@/app/actions/invitation'

const fd = (o: Record<string, string>) => {
  const f = new FormData()
  for (const [k, v] of Object.entries(o)) f.set(k, v)
  return f
}
let n = 0
const novyMail = () => `osoba${++n}@firma.cz`

beforeEach(() => {
  vi.clearAllMocks()
  ip.value = `10.0.0.${++n}` // každý test má vlastní IP, ať se limity nepřenášejí
  db.user.findUnique.mockResolvedValue(null)
  inv.inviteByMail.mockResolvedValue({ emailed: true })
})

describe('requestPasswordReset: žádné orákulum účtů', () => {
  it('známý a neznámý e-mail dají stejnou odpověď', async () => {
    const znamy = novyMail()
    const neznamy = novyMail()
    db.user.findUnique.mockImplementation(async ({ where }: { where: { email: string } }) => (where.email === znamy ? { id: 'u1' } : null))
    const a = await requestPasswordReset(fd({ email: znamy }))
    const b = await requestPasswordReset(fd({ email: neznamy }))
    expect(a).toEqual(b)
    expect(a).toHaveProperty('ok', true)
  })

  it('odpověď nečeká na vytvoření odkazu ani na e-mail (čas neprozradí existenci účtu)', async () => {
    const email = novyMail()
    db.user.findUnique.mockResolvedValue({ id: 'u1' })
    inv.inviteByMail.mockReturnValue(new Promise(() => {})) // nikdy nedoběhne
    const r = await Promise.race([requestPasswordReset(fd({ email })), new Promise((res) => setTimeout(() => res('ZAVĚŠENO'), 200))])
    expect(r).toHaveProperty('ok', true)
  })

  it('selhání odkazu / e-mailu se neprojeví v odpovědi', async () => {
    const email = novyMail()
    db.user.findUnique.mockResolvedValue({ id: 'u1' })
    inv.inviteByMail.mockRejectedValue(new Error('db spadla'))
    const r = await requestPasswordReset(fd({ email }))
    expect(r).toHaveProperty('ok', true)
    await new Promise((res) => setTimeout(res, 10)) // neodchycené odmítnutí by shodilo test
  })

  it('odkaz se vytvoří jen pro známý e-mail, jako obnova a bez členství; neznámému nic nejde', async () => {
    const znamy = novyMail()
    db.user.findUnique.mockResolvedValue({ id: 'u1' })
    await requestPasswordReset(fd({ email: `  ${znamy.toUpperCase()} ` }))
    expect(db.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { email: znamy } })) // stejná normalizace jako login
    expect(inv.inviteByMail).toHaveBeenCalledWith({ userId: 'u1', kind: 'reset' })

    inv.inviteByMail.mockClear()
    db.user.findUnique.mockResolvedValue(null)
    await requestPasswordReset(fd({ email: novyMail() }))
    expect(inv.inviteByMail).not.toHaveBeenCalled()
  })

  it('limit na e-mail platí stejně pro známý i neznámý (10 za hodinu) a nezávisí na IP', async () => {
    for (const existuje of [true, false]) {
      db.user.findUnique.mockResolvedValue(existuje ? { id: 'u1' } : null)
      const email = novyMail()
      const vysledky = []
      for (let i = 0; i < 11; i++) {
        ip.value = `20.0.${n}.${i}` // jiná IP při každém pokusu: brzdí tedy e-mail
        vysledky.push(await requestPasswordReset(fd({ email })))
      }
      expect(vysledky.map((r) => 'ok' in r)).toEqual([...Array(10).fill(true), false])
      expect(vysledky[10]).toEqual({ error: 'Příliš mnoho pokusů. Zkuste to za chvíli.' })
    }
  })

  it('limit na IP: 11. žádost z jedné adresy (s různými e-maily) se zastaví', async () => {
    ip.value = '30.0.0.1'
    const r = []
    for (let i = 0; i < 11; i++) r.push(await requestPasswordReset(fd({ email: novyMail() })))
    expect(r.slice(0, 10).every((x) => 'ok' in x)).toBe(true)
    expect(r[10]).toEqual({ error: 'Příliš mnoho pokusů. Zkuste to za chvíli.' })
  })

  it('neplatný e-mail: česká chyba a žádný dotaz do databáze', async () => {
    const r = await requestPasswordReset(fd({ email: 'neni-email' }))
    expect(r).toEqual({ error: 'Zadej platný e-mail.' })
    expect(db.user.findUnique).not.toHaveBeenCalled()
  })
})

describe('setPassword', () => {
  it('neshodná hesla: chyba a pozvánka se nespotřebuje', async () => {
    const r = await setPassword('t'.repeat(43), fd({ password: 'abcdefghij1', password2: 'abcdefghij2' }))
    expect(r).toEqual({ error: 'Hesla se neshodují.' })
    expect(inv.consumeInvitation).not.toHaveBeenCalled()
  })

  it('úspěch přesměruje na přihlášení', async () => {
    inv.consumeInvitation.mockResolvedValue({ ok: true })
    await expect(setPassword('t'.repeat(43), fd({ password: 'abcdefghij1', password2: 'abcdefghij1' }))).rejects.toThrow('NEXT_REDIRECT:/prihlaseni?heslo=nastaveno')
    expect(inv.consumeInvitation).toHaveBeenCalledWith('t'.repeat(43), 'abcdefghij1')
  })

  it('chyba z consumeInvitation se předá a nepřesměruje', async () => {
    inv.consumeInvitation.mockResolvedValue({ error: 'Odkaz už neplatí. Požádej o nový.' })
    const r = await setPassword('t'.repeat(43), fd({ password: 'abcdefghij1', password2: 'abcdefghij1' }))
    expect(r).toEqual({ error: 'Odkaz už neplatí. Požádej o nový.' })
  })

  it('hádání odkazů brzdí limit na IP (10 pokusů)', async () => {
    inv.consumeInvitation.mockResolvedValue({ error: 'x' })
    ip.value = '40.0.0.1'
    for (let i = 0; i < 10; i++) await setPassword('t', fd({ password: 'a', password2: 'a' }))
    const r = await setPassword('t', fd({ password: 'a', password2: 'a' }))
    expect(r).toEqual({ error: 'Příliš mnoho pokusů. Zkuste to za chvíli.' })
  })
})

describe("soubor s 'use server'", () => {
  it('exportuje jen akce volatelné z prohlížeče', () => {
    expect(Object.keys(modul).sort()).toEqual(['requestPasswordReset', 'setPassword'])
  })
})
