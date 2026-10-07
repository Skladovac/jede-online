import 'server-only'
import { prisma } from '@/lib/prisma'
import { byLocalId } from '@/lib/format'
import { setProgress } from '@/lib/progress'

/** Přehled sbírky uživatele: postup po sadách, chybějící karty a nabídky. Sdílí /sbirka a veřejný profil. */
export async function collectionOverview(userId: string) {
  const productInclude = { product: { include: { set: { select: { logoUrl: true } } } } }
  const [items, wants, productItems, productWants] = await Promise.all([
    prisma.collectionItem.findMany({
      where: { userId },
      include: { card: { include: { set: true } } },
    }),
    prisma.wantItem.findMany({
      where: { userId },
      include: { card: { include: { set: true } } },
    }),
    prisma.productItem.findMany({ where: { userId }, include: productInclude, orderBy: { updatedAt: 'desc' } }),
    prisma.productWant.findMany({ where: { userId }, include: productInclude, orderBy: { createdAt: 'desc' } }),
  ])

  // Postup po sadách (počítá se karta, ne kus).
  const bySet = new Map<string, { set: (typeof items)[number]['card']['set']; cards: Set<string> }>()
  for (const i of items) {
    const e = bySet.get(i.card.setId) ?? { set: i.card.set, cards: new Set<string>() }
    e.cards.add(i.cardId)
    bySet.set(i.card.setId, e)
  }
  // Tři postupy (base / complete / master) pro každou sadu ve sbírce.
  const progress = await setProgress(userId, [...bySet.keys()])
  const sets = [...bySet.values()]
    .map((e) => ({ set: e.set, owned: e.cards.size, progress: progress.get(e.set.id)! }))
    .sort((a, b) => (b.set.releaseDate?.getTime() ?? 0) - (a.set.releaseDate?.getTime() ?? 0))

  const offers = items
    .filter((i) => i.spareQty > 0 && i.offerType && !i.hiddenAt)
    .sort((a, b) => a.card.set.name.localeCompare(b.card.set.name) || byLocalId(a.card, b.card))
  // U chybějící karty i poptávka „chci koupit“ (štítek „koupím do X Kč“).
  const wanted = wants
    .map((w) => ({ ...w.card, buy: w.buy, maxPriceCzk: w.maxPriceCzk }))
    .sort((a, b) => a.set.name.localeCompare(b.set.name) || byLocalId(a, b))

  return {
    sets,
    offers,
    wanted,
    productItems,
    productWants: productWants.map((w) => ({ ...w.product, buy: w.buy, maxPriceCzk: w.maxPriceCzk })),
    totals: {
      cards: new Set(items.map((i) => i.cardId)).size,
      pieces: items.reduce((s, i) => s + i.quantity, 0),
      spare: items.reduce((s, i) => s + i.spareQty, 0),
      wanted: wanted.length,
    },
  }
}

export type Overview = Awaited<ReturnType<typeof collectionOverview>>
