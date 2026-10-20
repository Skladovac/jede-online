import 'server-only'
import { prisma } from '@/lib/prisma'
import { collectionOverview } from '@/lib/collection-view'
import { portfolio } from '@/lib/portfolio'
import { searchCards } from '@/lib/search'
import { ensureEurCzk, eurCzkRate } from '@/lib/fx'
import { setDisplayName } from '@/lib/format'
import { auctionInclude } from '@/lib/auctions'

/**
 * Data pro AI asistenty — jen čtení, bez cizích e-mailů a telefonů. Používá je MCP server (/mcp) i REST (/api/v1).
 * Ceny: EUR z Cardmarketu + orientační přepočet na Kč kurzem ČNB.
 */
const SITE = 'https://pokemon.jede.online'
const VARIANT_LABEL: Record<string, string> = { NORMAL: 'normální', HOLO: 'holo', REVERSE: 'reverse holo', FIRST_EDITION: '1st edition', POKEBALL: 'Poké Ball reverse', MASTERBALL: 'Master Ball reverse' }
const OFFER_LABEL: Record<string, string> = { SELL: 'prodej', TRADE: 'výměna', GIFT: 'zdarma za poštovné' }

let rate = 25
const czk = (eur: unknown) => (eur == null ? null : Math.max(1, Math.round(Number(eur) * rate)))
const price = (eur: unknown) => (eur == null ? null : { eur: Number(Number(eur).toFixed(2)), czk: czk(eur) })
async function fx() {
  await ensureEurCzk()
  rate = eurCzkRate() ?? 25
}

const cardRef = (c: { id: string; name: string; localId: string; set: { id: string; name: string; code: string | null; officialCount: number } }) => ({
  id: c.id,
  name: c.name,
  number: `${c.localId}${c.set.officialCount ? `/${c.set.officialCount}` : ''}`,
  set: { id: c.set.id, name: setDisplayName(c.set), code: c.set.code },
  url: `${SITE}/karta/${encodeURIComponent(c.id)}`,
})

/** Souhrn účtu: velikost a hodnota sbírky, postup v sadách. */
export async function aiOverview(userId: string, nickname: string) {
  await fx()
  const [o, p] = await Promise.all([collectionOverview(userId), portfolio(userId)])
  return {
    nickname,
    profileUrl: `${SITE}/@${encodeURIComponent(nickname)}`,
    totals: { distinctCards: o.totals.cards, pieces: o.totals.pieces, spareForTrade: o.totals.spare, missingMarked: o.totals.wanted, offers: o.offers.length },
    value: { czk: p.valueCzk, eur: p.valueEur, note: 'Orientační hodnota podle cen Cardmarketu (trend), bez ohledu na stav karet.' },
    sets: o.sets.map((s) => ({
      id: s.set.id,
      name: setDisplayName(s.set),
      code: s.set.code,
      owned: s.owned,
      base: s.progress.base,
      complete: s.progress.complete,
      master: s.progress.master,
      url: `${SITE}/sady/${encodeURIComponent(s.set.id)}`,
    })),
  }
}

/** Moje karty (volitelně jen jedna sada). */
export async function aiCollection(userId: string, setId?: string | null, limit = 500) {
  await fx()
  const items = await prisma.collectionItem.findMany({
    where: { userId, quantity: { gt: 0 }, ...(setId && { card: { setId } }) },
    include: { card: { include: { set: { select: { id: true, name: true, code: true, officialCount: true } } } } },
    orderBy: [{ card: { setId: 'asc' } }, { card: { localId: 'asc' } }],
    take: Math.min(limit, 2000),
  })
  return items.map((i) => ({
    ...cardRef(i.card),
    quantity: i.quantity,
    spare: i.spareQty,
    variant: VARIANT_LABEL[i.variant] ?? i.variant,
    condition: i.condition,
    language: i.language,
    note: i.note,
    offer: i.offerType && i.spareQty > 0 ? { type: OFFER_LABEL[i.offerType], priceCzk: i.priceCzk } : null,
    purchasePriceCzk: i.purchasePriceCzk,
    price: price(['REVERSE', 'POKEBALL', 'MASTERBALL'].includes(i.variant) ? (i.card.priceReverseEur ?? i.card.priceEur) : i.card.priceEur),
  }))
}

/** Chybějící karty (označené „Chybí“) + kdo je nabízí. `setId` zúží na sadu; `all=true` = vše, co v sadě nemám. */
export async function aiMissing(userId: string, setId?: string | null, all = false) {
  await fx()
  const where = all && setId
    ? { setId, items: { none: { userId, quantity: { gt: 0 } } } }
    : { wants: { some: { userId } }, ...(setId && { setId }), items: { none: { userId, quantity: { gt: 0 } } } }
  const cards = await prisma.card.findMany({
    where,
    include: {
      set: { select: { id: true, name: true, code: true, officialCount: true } },
      wants: { where: { userId }, select: { buy: true, maxPriceCzk: true } },
      items: {
        where: { spareQty: { gt: 0 }, offerType: { not: null }, hiddenAt: null, userId: { not: userId }, user: { bannedAt: null, OR: [{ isMinor: false }, { parentConsentAt: { not: null } }] } },
        select: { offerType: true, priceCzk: true, spareQty: true, user: { select: { nickname: true, city: true, region: true } } },
        take: 5,
      },
    },
    orderBy: [{ setId: 'asc' }, { localId: 'asc' }],
    take: 1000,
  })
  return cards.map((c) => ({
    ...cardRef(c),
    rarity: c.rarity,
    price: price(c.priceEur),
    wantToBuy: c.wants[0]?.buy ? { maxPriceCzk: c.wants[0].maxPriceCzk } : null,
    offeredBy: c.items.map((i) => ({ nickname: i.user.nickname, place: i.user.city ?? i.user.region, type: OFFER_LABEL[i.offerType!], priceCzk: i.priceCzk, pieces: i.spareQty, profileUrl: `${SITE}/@${encodeURIComponent(i.user.nickname)}` })),
  }))
}

/** Hledání v katalogu (jméno, číslo, „SVI 045“). */
export async function aiSearch(q: string, limit = 12) {
  await fx()
  const hits = await searchCards(q, Math.min(limit, 30))
  return hits.map((c) => ({ ...cardRef({ ...c, set: { ...c.set, id: c.id.replace(/-[^-]+$/, '') } }), rarity: c.rarity, price: price(c.priceEur) }))
}

/** Detail karty z katalogu. */
export async function aiCard(id: string, userId?: string) {
  await fx()
  const c = await prisma.card.findUnique({ where: { id }, include: { set: { select: { id: true, name: true, code: true, officialCount: true, releaseDate: true } } } })
  if (!c) return null
  const [mine, offers] = await Promise.all([
    userId ? prisma.collectionItem.findMany({ where: { userId, cardId: id, quantity: { gt: 0 } }, select: { quantity: true, spareQty: true, variant: true, condition: true } }) : [],
    prisma.collectionItem.count({ where: { cardId: id, spareQty: { gt: 0 }, offerType: { not: null }, hiddenAt: null } }),
  ])
  return {
    ...cardRef(c),
    rarity: c.rarity,
    category: c.category,
    types: c.types,
    variants: [c.hasNormal && 'normální', c.hasHolo && 'holo', c.hasReverse && 'reverse holo', c.hasFirstEd && '1st edition', c.hasPokeball && 'Poké Ball reverse', c.hasMasterball && 'Master Ball reverse'].filter(Boolean),
    price: price(c.priceEur),
    priceReverse: price(c.priceReverseEur),
    priceUpdatedAt: c.priceUpdatedAt,
    offersOnSite: offers,
    mine: mine.map((m) => ({ quantity: m.quantity, spare: m.spareQty, variant: VARIANT_LABEL[m.variant] ?? m.variant, condition: m.condition })),
    imageUrl: c.imageUrl ? `${c.imageUrl}/high.webp` : null,
  }
}

/** Sady (seznam) nebo jedna sada s mým postupem. */
export async function aiSets(userId: string, setId?: string | null) {
  if (setId) {
    const s = await prisma.cardSet.findUnique({ where: { id: setId }, select: { id: true, name: true, code: true, series: true, releaseDate: true, cardCount: true, officialCount: true, language: true } })
    if (!s) return null
    const [owned, wanted] = await Promise.all([
      prisma.collectionItem.findMany({ where: { userId, quantity: { gt: 0 }, card: { setId } }, select: { cardId: true }, distinct: ['cardId'] }),
      prisma.wantItem.count({ where: { userId, card: { setId } } }),
    ])
    return { ...s, name: setDisplayName(s), owned: owned.length, missingMarked: wanted, url: `${SITE}/sady/${encodeURIComponent(s.id)}` }
  }
  const sets = await prisma.cardSet.findMany({
    where: { game: 'pokemon' },
    select: { id: true, name: true, code: true, series: true, releaseDate: true, cardCount: true, officialCount: true, language: true },
    orderBy: { releaseDate: { sort: 'desc', nulls: 'last' } },
  })
  return sets.map((s) => ({ ...s, name: setDisplayName(s), url: `${SITE}/sady/${encodeURIComponent(s.id)}` }))
}

/** Moje žádosti o výměnu (bez kontaktů druhé strany). */
export async function aiRequests(userId: string) {
  const reqs = await prisma.tradeRequest.findMany({
    where: { OR: [{ fromId: userId }, { toId: userId }], status: { not: 'DRAFT' } },
    include: { from: { select: { nickname: true } }, to: { select: { nickname: true } }, items: { select: { title: true, quantity: true, fromRequester: true } } },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  })
  return reqs.map((r) => ({
    id: r.id,
    status: r.status,
    iAm: r.fromId === userId ? 'requester' : 'owner',
    with: r.fromId === userId ? r.to.nickname : r.from.nickname,
    iGet: r.items.filter((i) => !i.fromRequester).map((i) => `${i.quantity}× ${i.title}`),
    iGive: r.items.filter((i) => i.fromRequester).map((i) => `${i.quantity}× ${i.title}`),
    updatedAt: r.updatedAt,
    url: `${SITE}/poptavky/${r.id}`,
  }))
}

/** Moje aukce. */
export async function aiAuctions(userId: string) {
  const list = await prisma.auction.findMany({ where: { userId }, include: auctionInclude, orderBy: { endsAt: 'desc' }, take: 50 })
  return list.map((a) => ({
    id: a.id,
    title: a.title,
    endsAt: a.endsAt,
    ended: a.endsAt.getTime() <= Date.now(),
    startPriceCzk: a.startPriceCzk,
    externalUrl: a.url,
    items: a.items.map((i) => i.card?.name ?? i.product?.name),
    url: `${SITE}/aukce/${a.id}`,
  }))
}
