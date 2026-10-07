import 'server-only'
import { prisma } from '@/lib/prisma'
import { byLocalId, cardImage, productImage } from '@/lib/format'

/**
 * Náhradní obrázek pro sady bez loga (nejnovější sady, než ho TCGdex doplní):
 * booster pack → ETB → booster box ze zapečetěných produktů, jinak první karta sady.
 */
export async function setFallbackImages(sets: { id: string; logoUrl: string | null }[]) {
  const ids = sets.filter((s) => !s.logoUrl).map((s) => s.id)
  const out = new Map<string, string>()
  if (!ids.length) return out

  const products = await prisma.product.findMany({
    where: { setId: { in: ids }, imageUrl: { not: null }, kind: { in: ['BOOSTER', 'ETB', 'DISPLAY'] } },
    select: { setId: true, kind: true, imageUrl: true, name: true },
  })
  const rank = { BOOSTER: 0, ETB: 1, DISPLAY: 2 } as Record<string, number>
  for (const id of ids) {
    const best = products
      .filter((p) => p.setId === id)
      // Obyčejný booster má přednost před "Sleeved" a "Case" variantami.
      .sort((a, b) => rank[a.kind] - rank[b.kind] || a.name.length - b.name.length)[0]
    const img = best ? productImage(best.imageUrl) : null
    if (img) out.set(id, img)
  }

  const rest = ids.filter((id) => !out.has(id))
  if (rest.length) {
    const cards = await prisma.card.findMany({
      where: { setId: { in: rest }, imageUrl: { not: null } },
      select: { setId: true, localId: true, imageUrl: true },
    })
    for (const id of rest) {
      const first = cards.filter((c) => c.setId === id).sort(byLocalId)[0]
      const img = first ? cardImage(first.imageUrl) : null
      if (img) out.set(id, img)
    }
  }
  return out
}
