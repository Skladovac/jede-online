import 'server-only'
import type { Country, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

/**
 * „Najdi sběratele“: kdo má, co mi chybí (a naopak, kdo chce, co mám navíc).
 * Klíče položek: "c:<cardId>" pro karty, "p:<productId>" pro zapečetěné produkty.
 */

// Váhy skóre: nabízený kus je hned k mání, kus jen ve sbírce znamená „můžeš se zeptat“.
const W_OFFERED = 3
const W_OWNED = 1
const W_TRADE = 2 // za každou mou nabídku, kterou ten druhý shání (jen když jde o výměnu oběma směry)

export type Place = { country?: Country; region?: string }

/** Filtr místa z parametru ?kde=: "vse", "CZ", "SK" nebo "r:<kraj>". */
export function parsePlace(kde: string | undefined, fallbackRegion: string | null): { key: string; place: Place } {
  const key = kde ?? (fallbackRegion ? `r:${fallbackRegion}` : 'vse')
  if (key === 'CZ' || key === 'SK') return { key, place: { country: key } }
  if (key.startsWith('r:')) return { key, place: { region: key.slice(2) } }
  return { key: 'vse', place: {} }
}

// Viditelný = nezablokovaný a ne dítě bez souhlasu rodiče.
const visibleUser = (viewerId: string, place: Place = {}): Prisma.UserWhereInput => ({
  id: { not: viewerId },
  bannedAt: null,
  OR: [{ isMinor: false }, { parentConsentAt: { not: null } }],
  ...(place.country && { country: place.country }),
  ...(place.region && { region: place.region }),
})

const offeredWhere = { spareQty: { gt: 0 }, offerType: { not: null }, hiddenAt: null } as const

async function myLists(viewerId: string) {
  const [wantCards, wantProducts, spareCards, spareProducts] = await Promise.all([
    prisma.wantItem.findMany({ where: { userId: viewerId }, select: { cardId: true } }),
    prisma.productWant.findMany({ where: { userId: viewerId }, select: { productId: true } }),
    prisma.collectionItem.findMany({ where: { userId: viewerId, ...offeredWhere }, select: { cardId: true } }),
    prisma.productItem.findMany({ where: { userId: viewerId, ...offeredWhere }, select: { productId: true } }),
  ])
  return {
    wantCards: [...new Set(wantCards.map((w) => w.cardId))],
    wantProducts: [...new Set(wantProducts.map((w) => w.productId))],
    spareCards: [...new Set(spareCards.map((s) => s.cardId))],
    spareProducts: [...new Set(spareProducts.map((s) => s.productId))],
  }
}

export type Collector = {
  user: { id: string; nickname: string; city: string | null; region: string | null; country: Country }
  offered: number // nabízí z toho, co mi chybí
  owned: number // má jen ve sbírce
  theyWant: number // shání z toho, co mám navíc
  trade: boolean // výměna možná oběma směry
  score: number
  rating: { pos: number; neg: number }
  preview: { id: string; name: string; imageUrl: string | null; offered: boolean }[]
}

export async function findCollectors(viewerId: string, place: Place, limit = 50) {
  const mine = await myLists(viewerId)
  const users = visibleUser(viewerId, place)
  const [theirCards, theirProducts, wantMyCards, wantMyProducts] = await Promise.all([
    mine.wantCards.length
      ? prisma.collectionItem.findMany({
          where: { cardId: { in: mine.wantCards }, user: users },
          select: { userId: true, cardId: true, spareQty: true, offerType: true, hiddenAt: true },
        })
      : [],
    mine.wantProducts.length
      ? prisma.productItem.findMany({
          where: { productId: { in: mine.wantProducts }, user: users },
          select: { userId: true, productId: true, spareQty: true, offerType: true, hiddenAt: true },
        })
      : [],
    mine.spareCards.length
      ? prisma.wantItem.findMany({ where: { cardId: { in: mine.spareCards }, user: users }, select: { userId: true, cardId: true } })
      : [],
    mine.spareProducts.length
      ? prisma.productWant.findMany({
          where: { productId: { in: mine.spareProducts }, user: users },
          select: { userId: true, productId: true },
        })
      : [],
  ])

  type Acc = { offered: Set<string>; owned: Set<string>; theyWant: Set<string> }
  const acc = new Map<string, Acc>()
  const get = (id: string) => {
    let a = acc.get(id)
    if (!a) acc.set(id, (a = { offered: new Set(), owned: new Set(), theyWant: new Set() }))
    return a
  }
  const have = (userId: string, key: string, i: { spareQty: number; offerType: unknown; hiddenAt: Date | null }) => {
    const a = get(userId)
    if (i.spareQty > 0 && i.offerType && !i.hiddenAt) a.offered.add(key)
    else a.owned.add(key)
  }
  for (const i of theirCards) have(i.userId, `c:${i.cardId}`, i)
  for (const i of theirProducts) have(i.userId, `p:${i.productId}`, i)
  for (const w of wantMyCards) get(w.userId).theyWant.add(`c:${w.cardId}`)
  for (const w of wantMyProducts) get(w.userId).theyWant.add(`p:${w.productId}`)

  const ranked = [...acc.entries()]
    .map(([userId, a]) => {
      for (const k of a.offered) a.owned.delete(k) // jeden kus nabízí, jiný jen má → počítá se jako nabídka
      const offered = a.offered.size
      const owned = a.owned.size
      const theyWant = a.theyWant.size
      const trade = offered > 0 && theyWant > 0
      return { userId, a, offered, owned, theyWant, trade, score: offered * W_OFFERED + owned * W_OWNED + (trade ? theyWant * W_TRADE : 0) }
    })
    .filter((r) => r.offered + r.owned > 0)
    .sort((x, y) => Number(y.trade) - Number(x.trade) || y.score - x.score)
  const total = ranked.length
  const top = ranked.slice(0, limit)
  if (!top.length) return { collectors: [] as Collector[], total, mine }

  const ids = top.map((r) => r.userId)
  // Náhled: až 6 karet, nabízené napřed.
  const previewKeys = new Map(top.map((r) => [r.userId, [...r.a.offered, ...r.a.owned].filter((k) => k.startsWith('c:')).slice(0, 6)]))
  const previewCardIds = [...new Set([...previewKeys.values()].flat().map((k) => k.slice(2)))]
  const [userRows, ratings, cards] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, nickname: true, city: true, region: true, country: true } }),
    prisma.rating.groupBy({ by: ['toId', 'positive'], where: { toId: { in: ids }, hiddenAt: null }, _count: true }),
    prisma.card.findMany({ where: { id: { in: previewCardIds } }, select: { id: true, name: true, imageUrl: true } }),
  ])
  const userById = new Map(userRows.map((u) => [u.id, u]))
  const cardById = new Map(cards.map((c) => [c.id, c]))

  const collectors: Collector[] = top.map((r) => ({
    user: userById.get(r.userId)!,
    offered: r.offered,
    owned: r.owned,
    theyWant: r.theyWant,
    trade: r.trade,
    score: r.score,
    rating: {
      pos: ratings.find((x) => x.toId === r.userId && x.positive)?._count ?? 0,
      neg: ratings.find((x) => x.toId === r.userId && !x.positive)?._count ?? 0,
    },
    preview: previewKeys
      .get(r.userId)!
      .map((k) => cardById.get(k.slice(2)))
      .filter((c): c is NonNullable<typeof c> => !!c)
      .map((c) => ({ ...c, offered: r.a.offered.has(`c:${c.id}`) })),
  }))
  return { collectors, total, mine }
}

/** Detail shody mezi mnou a jedním sběratelem (na jeho profilu). */
export async function pairMatches(viewerId: string, otherId: string) {
  const mine = await myLists(viewerId)
  const cardInclude = { card: { include: { set: { select: { name: true } } } } } as const
  const [cardItems, productItems, theyWantCards, theyWantProducts] = await Promise.all([
    mine.wantCards.length
      ? prisma.collectionItem.findMany({ where: { userId: otherId, cardId: { in: mine.wantCards } }, include: cardInclude })
      : [],
    mine.wantProducts.length
      ? prisma.productItem.findMany({
          where: { userId: otherId, productId: { in: mine.wantProducts } },
          include: { product: { include: { set: { select: { logoUrl: true } } } } },
        })
      : [],
    mine.spareCards.length
      ? prisma.wantItem.findMany({ where: { userId: otherId, cardId: { in: mine.spareCards } }, include: cardInclude })
      : [],
    mine.spareProducts.length
      ? prisma.productWant.findMany({
          where: { userId: otherId, productId: { in: mine.spareProducts } },
          include: { product: { include: { set: { select: { logoUrl: true } } } } },
        })
      : [],
  ])
  const isOffer = (i: { spareQty: number; offerType: unknown; hiddenAt: Date | null }) => i.spareQty > 0 && !!i.offerType && !i.hiddenAt
  const offeredCards = cardItems.filter(isOffer)
  const offeredIds = new Set(offeredCards.map((i) => i.cardId))
  const ownedCards = [...new Map(cardItems.filter((i) => !offeredIds.has(i.cardId)).map((i) => [i.cardId, i.card])).values()]
  return {
    offeredCards,
    ownedCards,
    offeredProducts: productItems.filter(isOffer),
    theyWantCards: [...new Map(theyWantCards.map((w) => [w.cardId, w.card])).values()],
    theyWantProducts: theyWantProducts.map((w) => w.product),
  }
}
