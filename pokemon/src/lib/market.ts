import 'server-only'
import type { OfferType, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { Place } from '@/lib/matches'
import { getT } from '@/lib/i18n/server'
import type { TFunc } from '@/lib/i18n/config'

/** Tržiště: všechny nabídky (prodej / výměna) a poptávky „chci koupit“ na jednom místě. */

export type MarketTab = 'prodej' | 'koupim' | 'vymena'
export const PAGE_SIZE = 48

export type MarketEntry = {
  key: string
  href: string
  name: string
  sub: string
  image: { kind: 'card' | 'product'; url: string | null }
  label: string // „120 Kč“, „vyměním“, „koupí do 150 Kč“…
  user: { nickname: string; city: string | null; region: string | null }
  at: Date
}

const userWhere = (place: Place): Prisma.UserWhereInput => ({
  bannedAt: null,
  OR: [{ isMinor: false }, { parentConsentAt: { not: null } }],
  ...(place.country && { country: place.country }),
  ...(place.region && { region: place.region }),
})
const userSelect = { nickname: true, city: true, region: true } as const

const offerLabel = (t: TFunc, type: OfferType, price: number | null) =>
  type === 'SELL' ? (price ? `${price.toLocaleString('cs-CZ')} Kč` : t('prodám')) : type === 'GIFT' ? t('daruji za poštovné') : t('vyměním')
const buyLabel = (t: TFunc, price: number | null) =>
  price ? t('koupí do {price} Kč', { price: price.toLocaleString('cs-CZ') }) : t('koupí (dohodou)')

export async function marketEntries(tab: MarketTab, place: Place, setId: string | null, page: number) {
  const t = await getT()
  const users = userWhere(place)
  // Bereme víc z obou zdrojů (karty + produkty), slijeme podle času a ořízneme na stránku.
  const take = PAGE_SIZE * page + 1
  let entries: MarketEntry[]

  if (tab === 'koupim') {
    const [cards, products] = await Promise.all([
      prisma.wantItem.findMany({
        where: { buy: true, user: users, ...(setId && { card: { setId } }) },
        include: { card: { include: { set: { select: { name: true } } } }, user: { select: userSelect } },
        orderBy: { buyAt: { sort: 'desc', nulls: 'last' } },
        take,
      }),
      prisma.productWant.findMany({
        where: { buy: true, user: users, ...(setId && { product: { setId } }) },
        include: { product: true, user: { select: userSelect } },
        orderBy: { buyAt: { sort: 'desc', nulls: 'last' } },
        take,
      }),
    ])
    entries = [
      ...cards.map((w) => ({
        key: `w${w.id}`,
        href: `/karta/${encodeURIComponent(w.cardId)}`,
        name: w.card.name,
        sub: `${w.card.set.name} · ${w.card.localId}`,
        image: { kind: 'card' as const, url: w.card.imageUrl },
        label: buyLabel(t, w.maxPriceCzk),
        user: w.user,
        at: w.buyAt ?? w.updatedAt,
      })),
      ...products.map((w) => ({
        key: `pw${w.id}`,
        href: `/produkt/${w.productId}`,
        name: w.product.name,
        sub: t('zapečetěný produkt'),
        image: { kind: 'product' as const, url: w.product.imageUrl },
        label: buyLabel(t, w.maxPriceCzk),
        user: w.user,
        at: w.buyAt ?? w.updatedAt,
      })),
    ]
  } else {
    const types: OfferType[] = tab === 'prodej' ? ['SELL', 'GIFT'] : ['TRADE']
    const offered = { spareQty: { gt: 0 }, offerType: { in: types }, hiddenAt: null }
    const [cards, products] = await Promise.all([
      prisma.collectionItem.findMany({
        where: { ...offered, user: users, ...(setId && { card: { setId } }) },
        include: { card: { include: { set: { select: { name: true } } } }, user: { select: userSelect } },
        orderBy: { offeredAt: { sort: 'desc', nulls: 'last' } },
        take,
      }),
      prisma.productItem.findMany({
        where: { ...offered, user: users, ...(setId && { product: { setId } }) },
        include: { product: true, user: { select: userSelect } },
        orderBy: { offeredAt: { sort: 'desc', nulls: 'last' } },
        take,
      }),
    ])
    entries = [
      ...cards.map((i) => ({
        key: `c${i.id}`,
        href: `/karta/${encodeURIComponent(i.cardId)}`,
        name: i.card.name,
        sub: `${i.card.set.name} · ${i.card.localId}`,
        image: { kind: 'card' as const, url: i.card.imageUrl },
        label: (i.spareQty > 1 ? `${i.spareQty}× · ` : '') + offerLabel(t, i.offerType!, i.priceCzk),
        user: i.user,
        at: i.offeredAt ?? i.updatedAt,
      })),
      ...products.map((i) => ({
        key: `p${i.id}`,
        href: `/produkt/${i.productId}`,
        name: i.product.name,
        sub: `${t('zapečetěný produkt')} · ${i.language.toUpperCase()}`,
        image: { kind: 'product' as const, url: i.product.imageUrl },
        label: (i.spareQty > 1 ? `${i.spareQty}× · ` : '') + offerLabel(t, i.offerType!, i.priceCzk),
        user: i.user,
        at: i.offeredAt ?? i.updatedAt,
      })),
    ]
  }

  entries.sort((a, b) => b.at.getTime() - a.at.getTime())
  const start = PAGE_SIZE * (page - 1)
  return { entries: entries.slice(start, start + PAGE_SIZE), hasMore: entries.length > start + PAGE_SIZE }
}

/** Žebříček nejlépe hodnocených sběratelů (počet kladných, pak podíl kladných). */
export async function topRated(limit = 50) {
  const rows = await prisma.rating.groupBy({
    by: ['toId', 'positive'],
    where: { hiddenAt: null, from: { bannedAt: null }, to: { bannedAt: null, OR: [{ isMinor: false }, { parentConsentAt: { not: null } }] } },
    _count: true,
  })
  const by = new Map<string, { pos: number; neg: number }>()
  for (const r of rows) {
    const e = by.get(r.toId) ?? { pos: 0, neg: 0 }
    if (r.positive) e.pos += r._count
    else e.neg += r._count
    by.set(r.toId, e)
  }
  const ranked = [...by.entries()]
    .filter(([, e]) => e.pos > 0)
    .sort(([, a], [, b]) => b.pos - a.pos || a.neg - b.neg)
    .slice(0, limit)
  const [users, verified] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: ranked.map(([id]) => id) } },
      select: { id: true, nickname: true, city: true, region: true },
    }),
    prisma.rating.groupBy({
      by: ['toId'],
      where: { toId: { in: ranked.map(([id]) => id) }, hiddenAt: null, from: { bannedAt: null }, requestId: { not: null } },
      _count: true,
    }),
  ])
  const u = new Map(users.map((x) => [x.id, x]))
  const v = new Map(verified.map((x) => [x.toId, x._count]))
  return ranked
    .filter(([id]) => u.has(id))
    .map(([id, e]) => ({ user: u.get(id)!, ...e, verified: v.get(id) ?? 0, percent: Math.round((e.pos / (e.pos + e.neg)) * 100) }))
}
