export type PriceStats = {
  low?: number | null
  trend?: number | null
  avg1?: number | null
  avg7?: number | null
  avg30?: number | null
  reverse?: PriceStats | null
}

type Raw = Record<string, number | null | undefined> | null | undefined

const n = (v: number | null | undefined) => (v && v > 0 ? Math.round(v * 100) / 100 : null)

/** Z ceníku Cardmarketu (TCGdex pricing.cardmarket nebo price_guide) vytáhne přehled. suffix "-holo" = reverse holo. */
export function pickStats(cm: Raw, suffix = ''): PriceStats | null {
  if (!cm) return null
  const s = {
    low: n(cm['low' + suffix]),
    trend: n(cm['trend' + suffix]),
    avg1: n(cm['avg1' + suffix]),
    avg7: n(cm['avg7' + suffix]),
    avg30: n(cm['avg30' + suffix]),
  }
  return Object.values(s).some((v) => v != null) ? s : null
}
