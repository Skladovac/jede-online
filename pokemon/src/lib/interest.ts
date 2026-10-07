import 'server-only'
import { prisma } from '@/lib/prisma'

/**
 * „O tvoje karty je zájem“: karty, které mám ve sbírce (i když je nenabízím),
 * a jiní je chtějí koupit. Vrací kartu, počet zájemců a nejvyšší nabízenou cenu.
 */
export async function interestInMyCards(userId: string) {
  const owned = await prisma.collectionItem.findMany({ where: { userId }, select: { cardId: true, spareQty: true } })
  if (!owned.length) return []
  const spare = new Set(owned.filter((o) => o.spareQty > 0).map((o) => o.cardId))
  const wants = await prisma.wantItem.findMany({
    where: {
      buy: true,
      cardId: { in: [...new Set(owned.map((o) => o.cardId))] },
      userId: { not: userId },
      user: { bannedAt: null, OR: [{ isMinor: false }, { parentConsentAt: { not: null } }] },
    },
    include: { card: { include: { set: { select: { name: true } } } } },
  })
  const byCard = new Map<string, { card: (typeof wants)[number]['card']; buyers: number; best: number | null; spare: boolean }>()
  for (const w of wants) {
    const e = byCard.get(w.cardId) ?? { card: w.card, buyers: 0, best: null, spare: spare.has(w.cardId) }
    e.buyers++
    if (w.maxPriceCzk && (!e.best || w.maxPriceCzk > e.best)) e.best = w.maxPriceCzk
    byCard.set(w.cardId, e)
  }
  return [...byCard.values()].sort((a, b) => (b.best ?? 0) - (a.best ?? 0) || b.buyers - a.buyers)
}
