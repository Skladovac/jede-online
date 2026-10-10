import 'server-only'
import { prisma } from '@/lib/prisma'
import { ensureEurCzk, eurCzkRate } from '@/lib/fx'

export type ProposalItem = { id: string; cardId: string; name: string; number: string; imageUrl: string | null; czk: number }
export type Proposal = { get: ProposalItem[]; give: ProposalItem[]; getCzk: number; giveCzk: number }

const MAX_PER_SIDE = 6

/**
 * Návrh férové výměny se sběratelem, se kterým je shoda oběma směry:
 * jeho karty na výměnu, které mi chybí ↔ moje karty navíc, které shání on. Vyvažuje se podle cen z Cardmarketu
 * (orientačně — o konečné podobě výměny se domluví sami).
 */
export async function tradeProposal(viewerId: string, otherId: string): Promise<Proposal | null> {
  const [myWants, theirWants] = await Promise.all([
    prisma.wantItem.findMany({ where: { userId: viewerId }, select: { cardId: true } }),
    prisma.wantItem.findMany({ where: { userId: otherId }, select: { cardId: true } }),
  ])
  if (!myWants.length || !theirWants.length) return null
  const offerable = { spareQty: { gt: 0 }, hiddenAt: null } as const
  const select = { id: true, cardId: true, card: { select: { name: true, localId: true, imageUrl: true, priceEur: true, set: { select: { code: true } } } } } as const
  const [theirs, mine] = await Promise.all([
    prisma.collectionItem.findMany({
      where: { userId: otherId, ...offerable, offerType: { in: ['TRADE', 'GIFT'] }, cardId: { in: myWants.map((w) => w.cardId) } },
      select,
    }),
    prisma.collectionItem.findMany({
      where: { userId: viewerId, ...offerable, offerType: { not: null }, cardId: { in: theirWants.map((w) => w.cardId) } },
      select,
    }),
  ])
  if (!theirs.length || !mine.length) return null

  await ensureEurCzk()
  const rate = eurCzkRate() ?? 25
  const toItem = (i: (typeof theirs)[number]): ProposalItem => ({
    id: i.id,
    cardId: i.cardId,
    name: i.card.name,
    number: `${i.card.set.code ? `${i.card.set.code} ` : ''}${i.card.localId}`,
    imageUrl: i.card.imageUrl,
    czk: Math.round(Number(i.card.priceEur ?? 0) * rate),
  })
  // Jedna položka na kartu (víc řádků stejné karty v různých variantách nepotřebujeme).
  const uniq = (list: ProposalItem[]) => [...new Map(list.map((i) => [i.cardId, i])).values()].sort((a, b) => b.czk - a.czk)
  const poolGet = uniq(theirs.map(toItem))
  const poolGive = uniq(mine.map(toItem))

  // Začneme nejcennější kartou, kterou chci, a doplňujeme lehčí stranu kartou, která rozdíl nejlépe vyrovná.
  const get = [poolGet.shift()!]
  const give: ProposalItem[] = []
  const sum = (l: ProposalItem[]) => l.reduce((s, i) => s + i.czk, 0)
  const closest = (pool: ProposalItem[], target: number) => {
    let best = -1
    for (let k = 0; k < pool.length; k++) if (best < 0 || Math.abs(pool[k].czk - target) < Math.abs(pool[best].czk - target)) best = k
    return best < 0 ? null : pool.splice(best, 1)[0]
  }
  for (let step = 0; step < 2 * MAX_PER_SIDE; step++) {
    const diff = sum(get) - sum(give)
    const tolerance = Math.max(15, 0.15 * Math.max(sum(get), sum(give)))
    if (give.length && Math.abs(diff) <= tolerance) break
    if (diff >= 0 || !give.length) {
      if (give.length >= MAX_PER_SIDE) break
      const pick = closest(poolGive, diff)
      if (!pick) break
      give.push(pick)
    } else {
      if (get.length >= MAX_PER_SIDE) break
      const pick = closest(poolGet, -diff)
      if (!pick) break
      get.push(pick)
    }
  }
  if (!give.length) return null
  const getCzk = sum(get)
  const giveCzk = sum(give)
  // Výrazně nevyrovnaný návrh nenabízíme (to už není „férová“ výměna) — rozdíl nad 50 Kč a víc než 2,5×.
  const [lo, hi] = [Math.min(getCzk, giveCzk), Math.max(getCzk, giveCzk)]
  if (hi - lo > 50 && hi > 2.5 * Math.max(lo, 1)) return null
  return { get, give, getCzk, giveCzk }
}
