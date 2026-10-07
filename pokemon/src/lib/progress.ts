import 'server-only'
import { prisma } from '@/lib/prisma'

/** Číslo karty v základní sadě (1–oficiální počet); secret rare a TG/GG/SV podsady mají číslo vyšší nebo s písmeny. */
export function isBaseCard(localId: string, officialCount: number) {
  return /^\d+$/.test(localId) && Number(localId) >= 1 && Number(localId) <= officialCount
}

type Flags = { hasNormal: boolean; hasHolo: boolean; hasReverse: boolean; hasFirstEd: boolean; hasPokeball: boolean; hasMasterball: boolean }
export const cardVariants = (c: Flags) => {
  const v = [
    c.hasNormal && 'NORMAL',
    c.hasHolo && 'HOLO',
    c.hasReverse && 'REVERSE',
    c.hasFirstEd && 'FIRST_EDITION',
    c.hasPokeball && 'POKEBALL',
    c.hasMasterball && 'MASTERBALL',
  ].filter(
    (x): x is string => !!x,
  )
  return v.length ? v : ['NORMAL']
}

export type Progress = {
  base: { owned: number; total: number } | null // null = sada nemá oficiální číslování (promo)
  complete: { owned: number; total: number }
  master: { owned: number; total: number }
}

/**
 * Tři postupy sady, jak je počítají sběratelé:
 * base = základní karty 1–oficiální počet, complete = všechny karty sady (i secret a mimo číslování),
 * master = všechny karty × všechny varianty, ve kterých vyšly (normal, holo, reverse, 1st ed., Poké Ball, Master Ball).
 */
export async function setProgress(userId: string, setIds: string[]): Promise<Map<string, Progress>> {
  if (!setIds.length) return new Map()
  const [sets, cards, items] = await Promise.all([
    prisma.cardSet.findMany({ where: { id: { in: setIds } }, select: { id: true, officialCount: true } }),
    prisma.card.findMany({
      where: { setId: { in: setIds } },
      select: { id: true, setId: true, localId: true, hasNormal: true, hasHolo: true, hasReverse: true, hasFirstEd: true, hasPokeball: true, hasMasterball: true },
    }),
    prisma.collectionItem.findMany({
      where: { userId, quantity: { gt: 0 }, card: { setId: { in: setIds } } },
      select: { cardId: true, variant: true },
    }),
  ])
  const ownedCards = new Set(items.map((i) => i.cardId))
  const ownedVariants = new Set(items.map((i) => `${i.cardId}|${i.variant}`))
  const official = new Map(sets.map((s) => [s.id, s.officialCount]))

  const out = new Map<string, Progress>()
  for (const id of setIds) {
    const n = official.get(id) ?? 0
    out.set(id, { base: n ? { owned: 0, total: 0 } : null, complete: { owned: 0, total: 0 }, master: { owned: 0, total: 0 } })
  }
  for (const c of cards) {
    const p = out.get(c.setId)!
    const has = ownedCards.has(c.id)
    p.complete.total++
    if (has) p.complete.owned++
    if (p.base && isBaseCard(c.localId, official.get(c.setId)!)) {
      p.base.total++
      if (has) p.base.owned++
    }
    for (const v of cardVariants(c)) {
      p.master.total++
      if (ownedVariants.has(`${c.id}|${v}`)) p.master.owned++
    }
  }
  return out
}
