import { beforeEach, describe, expect, it, vi } from 'vitest'

// Dvě strany téže hranice: `setActiveOrg` cookie `dh_org` ZAPISUJE, `getOrgContext` podle ní vybírá
// členství. Obojí je přímo ta hranice mezi firmami, o kterou je celá tahle větev.
vi.mock('server-only', () => ({}))
const cookieStore = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }))
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => cookieStore) }))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`)
  }),
}))
const auth = vi.hoisted(() => ({ getCurrentUser: vi.fn(), requireUser: vi.fn() }))
vi.mock('@/lib/auth', () => auth)
const db = vi.hoisted(() => ({ membership: { findFirst: vi.fn(), findMany: vi.fn() } }))
vi.mock('@/lib/prisma', () => ({ prisma: db }))

import { getOrgContext, ORG_COOKIE } from '@/lib/org'
import { setActiveOrg } from '@/lib/org-actions'
import * as orgActionsModule from '@/lib/org-actions'

const org = (id: string) => ({ id, name: 'Firma ' + id, reportName: 'Firma ' + id, periodStartDay: 1, remindHour: 19 })
// Věrná náhrada databáze: u-me má AKTIVNÍ členství v o1 a NEAKTIVNÍ v o2; o3 je cizí firma.
const RADKY = [
  { id: 'm1', userId: 'u-me', orgId: 'o1', role: 'EMPLOYEE', active: true, tracksFrom: new Date(), org: org('o1') },
  { id: 'm2', userId: 'u-me', orgId: 'o2', role: 'OWNER', active: false, tracksFrom: new Date(), org: org('o2') },
  { id: 'm3', userId: 'u-jiny', orgId: 'o3', role: 'OWNER', active: true, tracksFrom: new Date(), org: org('o3') },
]

beforeEach(() => {
  vi.clearAllMocks()
  auth.getCurrentUser.mockResolvedValue({ id: 'u-me', isSuperAdmin: false })
  cookieStore.get.mockReturnValue(undefined)
  // Dotazy vrací jen to, co jejich `where` připouští — vypuštěná podmínka je tak v testu vidět.
  db.membership.findFirst.mockImplementation(async ({ where }: { where: { userId?: string; orgId?: string; active?: boolean } }) => {
    const r = RADKY.find(
      (m) =>
        (where.userId === undefined || m.userId === where.userId) &&
        (where.orgId === undefined || m.orgId === where.orgId) &&
        (where.active === undefined || m.active === where.active),
    )
    return r ? { id: r.id } : null
  })
  db.membership.findMany.mockImplementation(async ({ where }: { where: { userId?: string; active?: boolean } }) =>
    RADKY.filter((m) => (where.userId === undefined || m.userId === where.userId) && (where.active === undefined || m.active === where.active)),
  )
})

describe('setActiveOrg: přepínač firmy', () => {
  it('vlastní aktivní firma: cookie se nastaví (httpOnly, celá aplikace)', async () => {
    expect(await setActiveOrg('o1')).toBe(true)
    expect(cookieStore.set).toHaveBeenCalledTimes(1)
    const [jmeno, hodnota, volby] = cookieStore.set.mock.calls[0]
    expect(jmeno).toBe(ORG_COOKIE)
    expect(hodnota).toBe('o1')
    expect(volby).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/' })
  })

  it('cizí firma: cookie se NENASTAVÍ (dotaz nese userId přihlášeného)', async () => {
    expect(await setActiveOrg('o3')).toBe(false)
    expect(cookieStore.set).not.toHaveBeenCalled()
    expect(db.membership.findFirst.mock.calls[0][0].where).toEqual({ userId: 'u-me', orgId: 'o3', active: true })
  })

  it('vlastní, ale NEAKTIVNÍ členství: cookie se nenastaví', async () => {
    expect(await setActiveOrg('o2')).toBe(false)
    expect(cookieStore.set).not.toHaveBeenCalled()
  })

  it.each(['', null, undefined, 42, { orgId: 'o1' }])(
    'neřetězcová nebo prázdná hodnota (%j): nic se nenastaví a databáze se neptá',
    async (zle) => {
      expect(await setActiveOrg(zle as unknown as string)).toBe(false)
      expect(cookieStore.set).not.toHaveBeenCalled()
      expect(db.membership.findFirst).not.toHaveBeenCalled()
    },
  )

  it('nepřihlášený nepřepne nic', async () => {
    auth.getCurrentUser.mockResolvedValue(null)
    expect(await setActiveOrg('o1')).toBe(false)
    expect(cookieStore.set).not.toHaveBeenCalled()
    expect(db.membership.findFirst).not.toHaveBeenCalled()
  })

  it("soubor s 'use server' exportuje jen setActiveOrg (každý export je veřejně volatelný endpoint)", () => {
    expect(Object.keys(orgActionsModule).sort()).toEqual(['setActiveOrg'])
  })
})

describe('getOrgContext: výběr členství podle cookie', () => {
  it('čte z databáze jen AKTIVNÍ členství přihlášeného (podmínka je v dotazu, ne jen v pickMembership)', async () => {
    await getOrgContext()
    expect(db.membership.findMany.mock.calls[0][0].where).toEqual({ userId: 'u-me', active: true })
  })

  it('cookie na firmu, kde je členství neaktivní, spadne na vlastní aktivní firmu', async () => {
    cookieStore.get.mockReturnValue({ value: 'o2' })
    expect((await getOrgContext())?.org.id).toBe('o1')
  })

  it('cookie na cizí firmu nevybere nic mimo vlastní členství', async () => {
    cookieStore.get.mockReturnValue({ value: 'o3' })
    const ctx = await getOrgContext()
    expect(ctx?.org.id).toBe('o1')
    expect(ctx?.role).toBe('EMPLOYEE')
  })

  it('bez jediného aktivního členství vrací null (deaktivovaný člověk s platnou relací)', async () => {
    auth.getCurrentUser.mockResolvedValue({ id: 'u-sam', isSuperAdmin: false })
    expect(await getOrgContext()).toBeNull()
  })

  it('nepřihlášený: null a žádný dotaz do databáze', async () => {
    auth.getCurrentUser.mockResolvedValue(null)
    expect(await getOrgContext()).toBeNull()
    expect(db.membership.findMany).not.toHaveBeenCalled()
  })
})
