import 'server-only'
import { prisma } from '@/lib/prisma'

export { TAG_LABEL } from '@/lib/rating-tags'

/** Souhrn hodnocení uživatele (skrytá správcem se nepočítají). */
export async function ratingSummary(userId: string) {
  const rows = await prisma.rating.groupBy({
    by: ['positive'],
    where: { toId: userId, hiddenAt: null, from: { bannedAt: null } },
    _count: true,
  })
  const pos = rows.find((r) => r.positive)?._count ?? 0
  const neg = rows.find((r) => !r.positive)?._count ?? 0
  return { pos, neg, total: pos + neg, percent: pos + neg ? Math.round((pos / (pos + neg)) * 100) : null }
}
