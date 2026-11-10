import { beforeEach, describe, expect, it, vi } from 'vitest'

// Skutečné requireCan zůstává v provozu; zakazuje se jen `can` pro manageOrgSettings (a nic jiného).
// Tím test padá při záměně akce za jinou, při odstranění kontroly i při jejím přesunutí za zápis,
// a přežije neškodný refaktor.
vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => ({ get: () => undefined })) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`)
  }),
}))
vi.mock('@/lib/role', async (orig) => ({
  ...(await orig<typeof import('@/lib/role')>()),
  can: (_role: string, action: string) => action !== 'manageOrgSettings',
}))
const auth = vi.hoisted(() => ({ requireUser: vi.fn(), getCurrentUser: vi.fn() }))
vi.mock('@/lib/auth', () => auth)
const db = vi.hoisted(() => ({
  organization: { update: vi.fn(), updateMany: vi.fn() },
  membership: { findMany: vi.fn() },
  $transaction: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@/lib/invitation', () => ({ createInvitation: vi.fn(), sendInvitationMail: vi.fn(), notifyAddedToOrg: vi.fn() }))

import { updateOrgSettings } from '@/app/actions/org'

describe('updateOrgSettings: brána je přesně manageOrgSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.getCurrentUser.mockResolvedValue({ id: 'u', isSuperAdmin: false })
    db.membership.findMany.mockResolvedValue([
      { id: 'm', orgId: 'o', role: 'OWNER', active: true, tracksFrom: new Date(), org: { id: 'o', name: 'F', reportName: 'F', periodStartDay: 1, remindHour: 19 } },
    ])
  })

  it('správce firmy, kterému je zakázáno jen manageOrgSettings, je přesměrován a nic se nezapíše', async () => {
    await expect(updateOrgSettings({ reportName: 'F', periodStartDay: 1, remindHour: 8 }, 'o')).rejects.toThrow('NEXT_REDIRECT:/')
    expect(db.organization.update.mock.calls.length + db.organization.updateMany.mock.calls.length + db.$transaction.mock.calls.length).toBe(0)
  })
})
