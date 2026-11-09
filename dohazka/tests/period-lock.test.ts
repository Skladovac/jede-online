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
  periodLock: { upsert: vi.fn(), deleteMany: vi.fn() },
  membership: { findMany: vi.fn() },
}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))

import { lockPeriod, unlockPeriod } from '@/app/actions/lock'
import * as lockModule from '@/app/actions/lock'
import { isLocked } from '@/lib/period-lock'

const org = { id: 'o-ctx', name: 'Firma', reportName: 'Firma', periodStartDay: 1, remindHour: 19 }
function jaJsem(role: 'OWNER' | 'ACCOUNTANT' | 'EMPLOYEE', isSuperAdmin = false) {
  auth.getCurrentUser.mockResolvedValue({ id: 'u-me', isSuperAdmin })
  db.membership.findMany.mockResolvedValue([{ id: 'm-me', orgId: 'o-ctx', role, active: true, tracksFrom: new Date(), org }])
}
const zapisy = () => db.periodLock.upsert.mock.calls.length + db.periodLock.deleteMany.mock.calls.length

beforeEach(() => {
  vi.clearAllMocks()
  jaJsem('OWNER')
  db.periodLock.upsert.mockResolvedValue({})
  db.periodLock.deleteMany.mockResolvedValue({ count: 1 })
})

describe('isLocked', () => {
  it('den v uzavřeném období je zamčený, jinde ne', () => {
    expect(isLocked(['2026-11'], 1, '2026-11-09')).toBe(true)
    expect(isLocked(['2026-11'], 1, '2026-10-31')).toBe(false)
    expect(isLocked([], 1, '2026-11-09')).toBe(false)
  })

  it('ctí první den období: při 16 patří 20. 11. do 2026-12 a 15. 11. do 2026-11', () => {
    expect(isLocked(['2026-12'], 16, '2026-11-20')).toBe(true)
    expect(isLocked(['2026-11'], 16, '2026-11-20')).toBe(false)
    expect(isLocked(['2026-11'], 16, '2026-11-15')).toBe(true)
  })

  it('prosinec přeteče do ledna dalšího roku', () => {
    expect(isLocked(['2027-01'], 16, '2026-12-20')).toBe(true)
  })
})

describe('lockPeriod / unlockPeriod: oprávnění', () => {
  it('zaměstnanec je odmítnut a nic se nezapíše', async () => {
    jaJsem('EMPLOYEE')
    await expect(lockPeriod('2026-11', 'o-ctx')).rejects.toThrow('NEXT_REDIRECT:/')
    await expect(unlockPeriod('2026-11', 'o-ctx')).rejects.toThrow('NEXT_REDIRECT:/')
    expect(zapisy()).toBe(0)
  })

  // Otevření je vlastní akce matice ('unlockPeriod'), kterou účetní nemá, takže requireCan přesměruje
  // stejně jako u zaměstnance. Dřív to byla ruční podmínka v akci a vracela chybu.
  it('účetní smí uzavřít, ale ne otevřít', async () => {
    jaJsem('ACCOUNTANT')
    expect(await lockPeriod('2026-11', 'o-ctx')).toEqual({ ok: true })
    await expect(unlockPeriod('2026-11', 'o-ctx')).rejects.toThrow('NEXT_REDIRECT:/')
    expect(db.periodLock.deleteMany).not.toHaveBeenCalled()
  })

  it('správce otevře; super admin také', async () => {
    expect(await unlockPeriod('2026-11', 'o-ctx')).toEqual({ ok: true })
    jaJsem('EMPLOYEE', true)
    expect(await unlockPeriod('2026-11', 'o-ctx')).toEqual({ ok: true })
    expect(db.periodLock.deleteMany).toHaveBeenCalledTimes(2)
  })

  it('nepřihlášený je odmítnut', async () => {
    auth.getCurrentUser.mockResolvedValue(null)
    await expect(lockPeriod('2026-11', 'o-ctx')).rejects.toThrow('NEXT_REDIRECT:/prihlaseni')
    expect(zapisy()).toBe(0)
  })
})

describe('lockPeriod / unlockPeriod: vstup a zápis', () => {
  it.each(['', '2026-13', '2026-1', '1999-12', '2101-01', '2026-11-01', 'x', ' 2026-11'])('periodKey %j se odmítne bez zápisu', async (k) => {
    expect(await lockPeriod(k, 'o-ctx')).toHaveProperty('error')
    expect(await unlockPeriod(k, 'o-ctx')).toHaveProperty('error')
    expect(zapisy()).toBe(0)
  })

  it.each([null, undefined, 202611, {}, ['2026-11']])('periodKey jiného typu než řetězec (%j) se odmítne', async (k) => {
    expect(await lockPeriod(k as unknown as string, 'o-ctx')).toHaveProperty('error')
    expect(await unlockPeriod(k as unknown as string, 'o-ctx')).toHaveProperty('error')
    expect(zapisy()).toBe(0)
  })

  it('orgId a lockedById jsou z kontextu', async () => {
    await lockPeriod('2026-11', 'o-ctx')
    const arg = db.periodLock.upsert.mock.calls[0][0]
    expect(arg.where).toEqual({ orgId_periodKey: { orgId: 'o-ctx', periodKey: '2026-11' } })
    expect(arg.create).toEqual({ orgId: 'o-ctx', periodKey: '2026-11', lockedById: 'u-me' })
    expect(arg.update).toEqual({})
  })

  it('opakované uzavření nespadne (upsert, ne create)', async () => {
    expect(await lockPeriod('2026-11', 'o-ctx')).toEqual({ ok: true })
    expect(await lockPeriod('2026-11', 'o-ctx')).toEqual({ ok: true })
  })

  it('otevření maže jen v aktivní firmě', async () => {
    await unlockPeriod('2026-11', 'o-ctx')
    expect(db.periodLock.deleteMany).toHaveBeenCalledWith({ where: { orgId: 'o-ctx', periodKey: '2026-11' } })
  })
})

// Okno, které zůstalo na předchozí firmě (nebo stránka z doby před nasazením). Uzávěrka je to, co firmě
// drží čísla pro mzdy, takže zamknout nebo otevřít měsíc CIZÍ firmy je stejně drahé jako do ní zapsat.
describe('uzávěrka ze stránky, která už neplatí (přepnutá firma nebo stará verze)', () => {
  const HLASKA = 'Tahle stránka už neplatí (přepnutá firma nebo stará verze). Obnov ji a zkus to znovu.'

  it('lockPeriod s jiným orgId: chyba a žádný zápis', async () => {
    expect(await lockPeriod('2026-11', 'o-jina')).toEqual({ error: HLASKA })
    expect(zapisy()).toBe(0)
  })

  it('unlockPeriod s jiným orgId: chyba a žádné mazání uzávěrky', async () => {
    expect(await unlockPeriod('2026-11', 'o-jina')).toEqual({ error: HLASKA })
    expect(db.periodLock.deleteMany).not.toHaveBeenCalled()
    expect(zapisy()).toBe(0)
  })

  it.each([undefined, null, '', 42, { orgId: 'o-ctx' }])('chybějící nebo neřetězcová hodnota (%j) je taky odmítnutí', async (zle) => {
    expect(await lockPeriod('2026-11', zle as unknown as string)).toEqual({ error: HLASKA })
    expect(await unlockPeriod('2026-11', zle as unknown as string)).toEqual({ error: HLASKA })
    expect(zapisy()).toBe(0)
  })

  it('kontrola je dřív než platnost klíče: cizí firma se dozví o neplatné stránce, ne o období', async () => {
    expect(await lockPeriod('kravina', 'o-jina')).toEqual({ error: HLASKA })
    expect(zapisy()).toBe(0)
  })

  it('super admin přepnutý na firmu A taky neotevře měsíc firmy B', async () => {
    jaJsem('EMPLOYEE', true)
    expect(await unlockPeriod('2026-11', 'o-jina')).toEqual({ error: HLASKA })
    expect(zapisy()).toBe(0)
  })

  it('firma z kontextu projde (důkaz, že kontrola nezakazuje všechno)', async () => {
    expect(await lockPeriod('2026-11', 'o-ctx')).toEqual({ ok: true })
    expect(await unlockPeriod('2026-11', 'o-ctx')).toEqual({ ok: true })
  })
})

describe("soubor s 'use server'", () => {
  it('exportuje jen lockPeriod a unlockPeriod (každý export je veřejně volatelná akce)', () => {
    expect(Object.keys(lockModule).sort()).toEqual(['lockPeriod', 'unlockPeriod'])
  })
})
