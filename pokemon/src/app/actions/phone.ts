'use server'

import { prisma } from '@/lib/prisma'
import { getCurrentUser, isLimited } from '@/lib/auth'
import { isAdult } from '@/lib/age'
import { formatPhone } from '@/lib/validation'

// Kolik různých čísel si jeden uživatel smí zobrazit za 24 hodin (proti sběru čísel).
const DAILY_LIMIT = 10

/** „Zobrazit číslo“ na profilu: jen přihlášený s ověřeným e-mailem; každé zobrazení se zapíše. */
export async function revealPhone(ownerId: string): Promise<{ phone: string } | { error: string }> {
  const viewer = await getCurrentUser()
  if (!viewer) return { error: 'Číslo uvidíš po přihlášení.' }
  if (!viewer.emailVerifiedAt) return { error: 'Nejdřív potvrď svůj e-mail (odkaz najdeš na stránce Můj účet).' }
  if (isLimited(viewer) || viewer.bannedAt) return { error: 'Číslo teď zobrazit nejde.' }

  const owner = await prisma.user.findUnique({ where: { id: ownerId } })
  if (!owner || !owner.phone || owner.bannedAt || !isAdult(owner)) return { error: 'Číslo není k dispozici.' }

  const since = new Date(Date.now() - 24 * 3_600_000)
  const seen = await prisma.phoneView.findFirst({ where: { viewerId: viewer.id, ownerId, createdAt: { gte: since } } })
  if (!seen && viewer.id !== ownerId) {
    const distinct = await prisma.phoneView.groupBy({ by: ['ownerId'], where: { viewerId: viewer.id, createdAt: { gte: since } } })
    if (distinct.length >= DAILY_LIMIT) return { error: 'Dnes už sis zobrazil(a) hodně čísel. Zkus to zítra.' }
  }
  if (viewer.id !== ownerId) await prisma.phoneView.create({ data: { viewerId: viewer.id, ownerId } })
  return { phone: formatPhone(owner.phone) }
}
