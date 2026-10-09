/**
 * Katalog odznaků (bez přístupu k DB, použitelné i na klientu).
 * Úrovně: 1 bronz, 2 stříbro, 3 zlato, 4 legendární. Jednorázové odznaky mají jen úroveň 1.
 */

export type BadgeId = 'reliable' | 'trader' | 'master' | 'complete' | 'collector' | 'japanese' | 'pioneer' | 'verified'

export type BadgeDef = {
  id: BadgeId
  icon: string
  name: string // český text = klíč překladu
  desc: string // co se počítá
  /** Prahy pro úrovně 1–4 (null = úroveň neexistuje). Jednorázové odznaky: undefined. */
  tiers?: [number | null, number | null, number | null, number | null]
}

// Pořadí = priorita při shodě úrovně (Spolehlivý první, buduje důvěru).
export const BADGES: BadgeDef[] = [
  { id: 'reliable', icon: '⭐', name: 'Spolehlivý', desc: 'Kladná minus záporná hodnocení z výměn přes web (aspoň 90 % kladných)', tiers: [3, 10, 30, 100] },
  { id: 'trader', icon: '🤝', name: 'Obchodník', desc: 'Dokončené výměny přes web', tiers: [1, 10, 50, 200] },
  { id: 'master', icon: '👑', name: 'Master set', desc: 'Sada se všemi kartami ve všech variantách', tiers: [null, null, null, 1] },
  { id: 'complete', icon: '📚', name: 'Kompletní set', desc: 'Sady s hotovým base setem', tiers: [1, 5, 15, null] },
  { id: 'collector', icon: '🃏', name: 'Sběratel', desc: 'Různé karty ve sbírce', tiers: [100, 500, 2000, 5000] },
  { id: 'japanese', icon: '🗾', name: 'Japonský sběratel', desc: 'Karty z japonských sad', tiers: [50, 250, 1000, null] },
  { id: 'pioneer', icon: '🎉', name: 'Průkopník', desc: 'Registrace ve zkušebním provozu (do konce roku 2026)' },
  { id: 'verified', icon: '✅', name: 'Ověřený', desc: 'Potvrzený e-mail (u dětí i souhlas rodiče)' },
]

export const BADGE_BY_ID = new Map(BADGES.map((b) => [b.id, b]))
export const PIONEER_UNTIL = new Date('2027-01-01T00:00:00+01:00')

export const LEVEL_NAME = ['', 'bronz', 'stříbro', 'zlato', 'legendární'] as const

/** Úroveň podle hodnoty (0 = zatím nic). */
export function levelFor(def: BadgeDef, value: number) {
  if (!def.tiers) return value > 0 ? 1 : 0
  let level = 0
  def.tiers.forEach((min, i) => {
    if (min !== null && value >= min) level = i + 1
  })
  return level
}

/** Další práh nad aktuální úrovní (pro „ještě 120 do stříbra“). */
export function nextTier(def: BadgeDef, level: number) {
  if (!def.tiers) return null
  for (let i = level; i < 4; i++) if (def.tiers[i] !== null) return { level: i + 1, min: def.tiers[i]! }
  return null
}

/** Skóre pro výběr nejlepšího odznaku: úroveň, jednorázové pod bronzem; při shodě pořadí v BADGES. */
export function badgeScore(id: BadgeId, level: number) {
  const def = BADGE_BY_ID.get(id)!
  const base = def.tiers ? level * 10 : 5
  return base * 100 - BADGES.indexOf(def)
}

export function parseTopBadge(v: string | null | undefined) {
  if (!v) return null
  const [id, lvl] = v.split(':')
  const def = BADGE_BY_ID.get(id as BadgeId)
  return def ? { def, level: Number(lvl) || 1 } : null
}

/** Barvy úrovní (rámeček odznaku). */
export const LEVEL_STYLE = [
  'border-slate-300 bg-slate-100 text-slate-400 dark:border-slate-700 dark:bg-slate-800',
  'border-amber-700/50 bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200',
  'border-slate-400 bg-slate-100 text-slate-800 dark:bg-slate-700/50 dark:text-slate-100',
  'border-yellow-400 bg-yellow-100 text-yellow-900 dark:bg-yellow-400/15 dark:text-yellow-200',
  'border-fuchsia-400 bg-gradient-to-br from-fuchsia-100 to-sky-100 text-fuchsia-900 dark:from-fuchsia-500/20 dark:to-sky-500/20 dark:text-fuchsia-100',
] as const
