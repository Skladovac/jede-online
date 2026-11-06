import type { Variant } from '@prisma/client'

export type CardVariantFlags = {
  hasNormal: boolean
  hasHolo: boolean
  hasReverse: boolean
  hasFirstEd: boolean
  hasPokeball: boolean
  hasMasterball: boolean
}

/** Varianty, ve kterých karta opravdu vyšla. Štítek „Normal“ se překládá až v komponentě. */
export function cardVariants(c: CardVariantFlags): { key: Variant; label: string }[] {
  const out: { key: Variant; label: string }[] = []
  if (c.hasNormal) out.push({ key: 'NORMAL', label: 'Normal' })
  if (c.hasHolo) out.push({ key: 'HOLO', label: 'Holo' })
  if (c.hasReverse) out.push({ key: 'REVERSE', label: 'Reverse holo' })
  if (c.hasFirstEd) out.push({ key: 'FIRST_EDITION', label: '1st edition' })
  if (c.hasPokeball) out.push({ key: 'POKEBALL', label: 'Poké Ball reverse' })
  if (c.hasMasterball) out.push({ key: 'MASTERBALL', label: 'Master Ball reverse' })
  // Karta bez údaje o variantách (promo, starší sady) — aspoň jedna, ať jde odkliknout.
  return out.length ? out : [{ key: 'NORMAL', label: 'Normal' }]
}
