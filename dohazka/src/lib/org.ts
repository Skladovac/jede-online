import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { pickMembership } from '@/lib/membership'
import { can, type ActionValue } from '@/lib/role'

export const ORG_COOKIE = 'dh_org'

/**
 * Ve které firmě člověk právě pracuje. V rámci požadavku se počítá jednou.
 * - Členství se čtou z databáze jen aktivní a jen vlastní (`userId`), takže cookie `dh_org`
 *   může vybrat jen z toho, co člověk opravdu má; je to klíč pro hledání, ne důvěryhodná hodnota.
 * - Role pochází z `Membership.role` (typ `Role` z Prismy), nikdy z cookie ani z URL.
 * - Bez aktivního členství vrací `null` (deaktivovaný člověk s ještě platnou relací).
 */
export const getOrgContext = cache(async () => {
  const user = await getCurrentUser()
  if (!user) return null
  const memberships = await prisma.membership.findMany({
    where: { userId: user.id, active: true },
    include: { org: true },
    orderBy: { createdAt: 'asc' },
  })
  const wanted = (await cookies()).get(ORG_COOKIE)?.value ?? null
  const membership = pickMembership(memberships, wanted)
  if (!membership) return null
  return { user, membership, org: membership.org, role: membership.role, isSuperAdmin: user.isSuperAdmin }
})

export type OrgContext = NonNullable<Awaited<ReturnType<typeof getOrgContext>>>

/** Kontext firmy; jinak přesměruje na přihlášení. */
export async function requireOrgContext(): Promise<OrgContext> {
  const ctx = await getOrgContext()
  if (!ctx) redirect('/prihlaseni')
  return ctx
}

/** Kontext firmy, a to jen pokud smí danou akci; jinak přesměruje na úvod. */
export async function requireCan(action: ActionValue): Promise<OrgContext> {
  const ctx = await requireOrgContext()
  if (!can(ctx.role, action, ctx.isSuperAdmin)) redirect('/')
  return ctx
}

/** Jen super admin; jinak přesměruje na úvod. */
export async function requireSuperAdmin(): Promise<OrgContext> {
  const ctx = await requireOrgContext()
  if (!ctx.isSuperAdmin) redirect('/')
  return ctx
}
