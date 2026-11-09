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
})

describe('updateOrgSettings: oprávnění', () => {
  it.each(['ACCOUNTANT', 'EMPLOYEE'] as const)('%s je odmítnut a nic se nezapíše', async (role) => {
    jaJsem(role)
    await expect(updateOrgSettings(platne)).rejects.toThrow('NEXT_REDIRECT:/')
    expect(zapisy()).toBe(0)
  })

  it('nepřihlášený je odmítnut a nic se nezapíše', async () => {
    auth.getCurrentUser.mockResolvedValue(null)
    await expect(updateOrgSettings(platne)).rejects.toThrow('NEXT_REDIRECT:/prihlaseni')
    expect(zapisy()).toBe(0)
  })

  it('oprávnění se kontroluje dřív než vstup: účetní s neplatným vstupem dostane přesměrování, ne chybu validace', async () => {
    jaJsem('ACCOUNTANT')
    await expect(updateOrgSettings({ ...platne, periodStartDay: 0 })).rejects.toThrow('NEXT_REDIRECT:/')
  })

  it('správce (OWNER) uloží', async () => {
    expect(await updateOrgSettings(platne)).toEqual({ ok: true })
    expect(db.organization.update).toHaveBeenCalledTimes(1)
  })

  it('super admin smí i bez role správce', async () => {
    jaJsem('EMPLOYEE', true)
    expect(await updateOrgSettings(platne)).toEqual({ ok: true })
  })
})

describe('updateOrgSettings: mezní hodnoty se odmítají, ne opravují', () => {
  it.each([0, 29, 31, -1, 1.5, NaN, Infinity])('periodStartDay %s: chyba a ŽÁDNÝ zápis', async (periodStartDay) => {
    const r = await updateOrgSettings({ ...platne, periodStartDay })
    expect(r).toHaveProperty('error')
    expect(db.organization.update).not.toHaveBeenCalled()
  })

  it.each([1, 28])('periodStartDay %s (hranice) projde beze změny', async (periodStartDay) => {
    expect(await updateOrgSettings({ ...platne, periodStartDay })).toEqual({ ok: true })
    expect(db.organization.update.mock.calls[0][0].data.periodStartDay).toBe(periodStartDay)
  })

  it.each([-1, 24, 25, 7.5, NaN])('remindHour %s: chyba a žádný zápis', async (remindHour) => {
    expect(await updateOrgSettings({ ...platne, remindHour })).toHaveProperty('error')
    expect(db.organization.update).not.toHaveBeenCalled()
  })

  it.each([0, 23])('remindHour %s (hranice) projde', async (remindHour) => {
    expect(await updateOrgSettings({ ...platne, remindHour })).toEqual({ ok: true })
  })

  it.each(['', '   ', '\t\n'])('reportName %j (prázdný nebo jen mezery): chyba a žádný zápis', async (reportName) => {
    expect(await updateOrgSettings({ ...platne, reportName })).toHaveProperty('error')
    expect(db.organization.update).not.toHaveBeenCalled()
  })

  it('reportName delší než 120 znaků se odmítne', async () => {
    expect(await updateOrgSettings({ ...platne, reportName: 'x'.repeat(121) })).toHaveProperty('error')
    expect(db.organization.update).not.toHaveBeenCalled()
  })

  it('řetězce místo čísel se nekonvertují (žádná koerce)', async () => {
    const r = await updateOrgSettings({ ...platne, periodStartDay: '5' as unknown as number })
    expect(r).toHaveProperty('error')
    expect(db.organization.update).not.toHaveBeenCalled()
  })

  it('název se ořízne od okrajových mezer', async () => {
    await updateOrgSettings({ ...platne, reportName: '  Firma  ' })
    expect(db.organization.update.mock.calls[0][0].data.reportName).toBe('Firma')
  })
})

describe('updateOrgSettings: zapisuje se jen do aktivní firmy a jen povolená pole', () => {
  it('id firmy je z kontextu, i když vstup podstrčí cizí organizationId / id / orgId', async () => {
    const zlomyslny = { ...platne, id: 'o-cizi', orgId: 'o-cizi', organizationId: 'o-cizi', name: 'Přepsané jméno' } as unknown as typeof platne
    expect(await updateOrgSettings(zlomyslny)).toEqual({ ok: true })
    expect(db.organization.update).toHaveBeenCalledTimes(1)
    const arg = db.organization.update.mock.calls[0][0]
    expect(arg.where).toEqual({ id: 'o-ctx' })
    // Zapsat jde přesně těch třech polí; nic navíc ze vstupu (ani id, ani name) se do dat nedostane.
    expect(arg.data).toEqual({ reportName: 'Nový název s.r.o.', periodStartDay: 16, remindHour: 8 })
    expect(JSON.stringify(arg)).not.toContain('o-cizi')
  })

  it('selhání databáze vrací obecnou chybu bez podrobností', async () => {
    db.organization.update.mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.1'))
    const r = await updateOrgSettings(platne)
    expect(r).toHaveProperty('error')
    expect(JSON.stringify(r)).not.toContain('ECONNREFUSED')
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
