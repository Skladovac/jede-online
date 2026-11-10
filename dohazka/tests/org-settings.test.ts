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
  organization: { update: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
  periodLock: { count: vi.fn() },
  membership: { findMany: vi.fn() },
  $transaction: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@/lib/invitation', () => ({ createInvitation: vi.fn(), sendInvitationMail: vi.fn(), notifyAddedToOrg: vi.fn() }))

import { updateOrgSettings } from '@/app/actions/org'
import * as orgModule from '@/app/actions/org'
import { orgSettingsSchema } from '@/lib/validation'

const org = { id: 'o-ctx', name: 'Firma', reportName: 'Firma s.r.o.', periodStartDay: 1, remindHour: 19 }
function jaJsem(role: 'OWNER' | 'ACCOUNTANT' | 'EMPLOYEE', isSuperAdmin = false) {
  auth.getCurrentUser.mockResolvedValue({ id: 'u-me', isSuperAdmin })
  db.membership.findMany.mockResolvedValue([{ id: 'm-me', orgId: 'o-ctx', role, active: true, tracksFrom: new Date(), org }])
}
const zapisy = () =>
  db.organization.update.mock.calls.length + db.organization.updateMany.mock.calls.length + db.organization.create.mock.calls.length + db.$transaction.mock.calls.length

const platne = { reportName: 'Nový název s.r.o.', periodStartDay: 16, remindHour: 8 }

beforeEach(() => {
  vi.clearAllMocks()
  jaJsem('OWNER')
  db.organization.update.mockResolvedValue({ id: 'o-ctx' })
  db.periodLock.count.mockResolvedValue(0)
})

describe('updateOrgSettings: oprávnění', () => {
  it.each(['ACCOUNTANT', 'EMPLOYEE'] as const)('%s je odmítnut a nic se nezapíše', async (role) => {
    jaJsem(role)
    await expect(updateOrgSettings(platne, 'o-ctx')).rejects.toThrow('NEXT_REDIRECT:/')
    expect(zapisy()).toBe(0)
  })

  it('nepřihlášený je odmítnut a nic se nezapíše', async () => {
    auth.getCurrentUser.mockResolvedValue(null)
    await expect(updateOrgSettings(platne, 'o-ctx')).rejects.toThrow('NEXT_REDIRECT:/prihlaseni')
    expect(zapisy()).toBe(0)
  })

  it('oprávnění se kontroluje dřív než vstup: účetní s neplatným vstupem dostane přesměrování, ne chybu validace', async () => {
    jaJsem('ACCOUNTANT')
    await expect(updateOrgSettings({ ...platne, periodStartDay: 0 }, 'o-ctx')).rejects.toThrow('NEXT_REDIRECT:/')
  })

  it('správce (OWNER) uloží', async () => {
    expect(await updateOrgSettings(platne, 'o-ctx')).toEqual({ ok: true })
    expect(db.organization.update).toHaveBeenCalledTimes(1)
  })

  it('super admin smí i bez role správce', async () => {
    jaJsem('EMPLOYEE', true)
    expect(await updateOrgSettings(platne, 'o-ctx')).toEqual({ ok: true })
  })
})

describe('updateOrgSettings: mezní hodnoty se odmítají, ne opravují', () => {
  it.each([0, 29, 31, -1, 1.5, NaN, Infinity])('periodStartDay %s: chyba a ŽÁDNÝ zápis', async (periodStartDay) => {
    const r = await updateOrgSettings({ ...platne, periodStartDay }, 'o-ctx')
    expect(r).toHaveProperty('error')
    expect(db.organization.update).not.toHaveBeenCalled()
  })

  it.each([1, 28])('periodStartDay %s (hranice) projde beze změny', async (periodStartDay) => {
    expect(await updateOrgSettings({ ...platne, periodStartDay }, 'o-ctx')).toEqual({ ok: true })
    expect(db.organization.update.mock.calls[0][0].data.periodStartDay).toBe(periodStartDay)
  })

  it.each([-1, 24, 25, 7.5, NaN])('remindHour %s: chyba a žádný zápis', async (remindHour) => {
    expect(await updateOrgSettings({ ...platne, remindHour }, 'o-ctx')).toHaveProperty('error')
    expect(db.organization.update).not.toHaveBeenCalled()
  })

  it.each([0, 23])('remindHour %s (hranice) projde', async (remindHour) => {
    expect(await updateOrgSettings({ ...platne, remindHour }, 'o-ctx')).toEqual({ ok: true })
  })

  it.each(['', '   ', '\t\n', 'Firma\u0000', 'A\nB', 'A\u007fB'])('reportName %j (prázdný nebo jen mezery): chyba a žádný zápis', async (reportName) => {
    expect(await updateOrgSettings({ ...platne, reportName }, 'o-ctx')).toHaveProperty('error')
    expect(db.organization.update).not.toHaveBeenCalled()
  })

  it('reportName delší než 120 znaků se odmítne', async () => {
    expect(await updateOrgSettings({ ...platne, reportName: 'x'.repeat(121) }, 'o-ctx')).toHaveProperty('error')
    expect(db.organization.update).not.toHaveBeenCalled()
  })

  it('řetězce místo čísel se nekonvertují (žádná koerce)', async () => {
    const r = await updateOrgSettings({ ...platne, periodStartDay: '5' as unknown as number }, 'o-ctx')
    expect(r).toHaveProperty('error')
    expect(db.organization.update).not.toHaveBeenCalled()
  })

  it('název se ořízne od okrajových mezer', async () => {
    await updateOrgSettings({ ...platne, reportName: '  Firma  ' }, 'o-ctx')
    expect(db.organization.update.mock.calls[0][0].data.reportName).toBe('Firma')
  })
})

describe('updateOrgSettings: zapisuje se jen do aktivní firmy a jen povolená pole', () => {
  it('id firmy je z kontextu, i když vstup podstrčí cizí organizationId / id / orgId', async () => {
    const zlomyslny = { ...platne, id: 'o-cizi', orgId: 'o-cizi', organizationId: 'o-cizi', name: 'Přepsané jméno' } as unknown as typeof platne
    expect(await updateOrgSettings(zlomyslny, 'o-ctx')).toEqual({ ok: true })
    expect(db.organization.update).toHaveBeenCalledTimes(1)
    const arg = db.organization.update.mock.calls[0][0]
    expect(arg.where).toEqual({ id: 'o-ctx' })
    // Zapsat jde přesně těch třech polí; nic navíc ze vstupu (ani id, ani name) se do dat nedostane.
    expect(arg.data).toEqual({ reportName: 'Nový název s.r.o.', periodStartDay: 16, remindHour: 8 })
    expect(JSON.stringify(arg)).not.toContain('o-cizi')
  })

  it('selhání databáze vrací obecnou chybu bez podrobností', async () => {
    db.organization.update.mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.1'))
    const r = await updateOrgSettings(platne, 'o-ctx')
    expect(r).toHaveProperty('error')
    expect(JSON.stringify(r)).not.toContain('ECONNREFUSED')
  })
})

describe('updateOrgSettings: s uzávěrkou se první den období nemění', () => {
  const HLASKA = 'Měsíc je už uzavřený, první den období se proto měnit nedá.'

  it('jiný periodStartDay při existující uzávěrce: chyba a žádný zápis', async () => {
    db.periodLock.count.mockResolvedValue(1)
    expect(await updateOrgSettings(platne, 'o-ctx')).toEqual({ error: HLASKA })
    expect(db.organization.update).not.toHaveBeenCalled()
    // Počítá se jen uzávěrka aktivní firmy.
    expect(db.periodLock.count).toHaveBeenCalledWith({ where: { orgId: 'o-ctx' } })
  })

  it('stejný periodStartDay při uzávěrce: uloží se (název a hodina se měnit smí)', async () => {
    db.periodLock.count.mockResolvedValue(3)
    expect(await updateOrgSettings({ ...platne, periodStartDay: 1 }, 'o-ctx')).toEqual({ ok: true })
    expect(db.organization.update).toHaveBeenCalledTimes(1)
  })

  it('jiný periodStartDay bez uzávěrky: uloží se', async () => {
    expect(await updateOrgSettings(platne, 'o-ctx')).toEqual({ ok: true })
  })
})

// Okno, které zůstalo na předchozí firmě (nebo stránka z doby před nasazením). Z celé té trojice akcí
// je tahle nejdražší: špatný `periodStartDay` u cizí firmy potichu přemapuje, které dny patří do kterého
// výkazního měsíce — a to na dokumentu, ze kterého se platí mzdy. Nikdo si nevšimne ničeho rozbitého.
describe('nastavení ze stránky, která už neplatí (přepnutá firma nebo stará verze)', () => {
  const HLASKA = 'Tahle stránka už neplatí (přepnutá firma nebo stará verze). Obnov ji a zkus to znovu.'

  it('jiné orgId: chyba, žádný zápis a ani dotaz do databáze', async () => {
    expect(await updateOrgSettings(platne, 'o-jina')).toEqual({ error: HLASKA })
    expect(zapisy()).toBe(0)
    expect(db.periodLock.count).not.toHaveBeenCalled()
  })

  it.each([undefined, null, '', 42, { orgId: 'o-ctx' }])('chybějící nebo neřetězcová hodnota (%j) je taky odmítnutí', async (zle) => {
    expect(await updateOrgSettings(platne, zle as unknown as string)).toEqual({ error: HLASKA })
    expect(zapisy()).toBe(0)
  })

  it('kontrola je dřív než validace: neplatný vstup z cizí stránky hlásí neplatnou stránku', async () => {
    expect(await updateOrgSettings({ ...platne, periodStartDay: 0 }, 'o-jina')).toEqual({ error: HLASKA })
    expect(zapisy()).toBe(0)
  })

  it('ani super admin nepřepíše nastavení firmy, na kterou není přepnutý', async () => {
    jaJsem('EMPLOYEE', true)
    expect(await updateOrgSettings(platne, 'o-jina')).toEqual({ error: HLASKA })
    expect(zapisy()).toBe(0)
  })

  it('firma z kontextu projde a zapisuje se dál podle kontextu (orgId je jen na porovnání)', async () => {
    expect(await updateOrgSettings(platne, 'o-ctx')).toEqual({ ok: true })
    expect(db.organization.update.mock.calls[0][0].where).toEqual({ id: 'o-ctx' })
  })
})

describe('schéma a export', () => {
  it('orgSettingsSchema vyžaduje všechna tři pole', () => {
    expect(orgSettingsSchema.safeParse({ reportName: 'A', periodStartDay: 1 }).success).toBe(false)
  })
  it('soubor se "use server" exportuje jen funkce (browser-callable akce)', () => {
    for (const [k, v] of Object.entries(orgModule)) expect(typeof v, k).toBe('function')
    expect(Object.keys(orgModule).sort()).toEqual(['createOrganization', 'updateOrgSettings'])
  })
})
