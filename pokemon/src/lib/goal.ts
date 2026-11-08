export type Counter = { owned: number; total: number }

/** Tři postupy sady: base = 1–oficiální počet, complete = i secret, master = všechny varianty. */
export type Progress = {
  base: Counter | null // null = sada nemá oficiální číslování (promo)
  complete: Counter
  master: Counter
}

export type Goal = 'base' | 'complete' | 'master'
export const GOALS: Goal[] = ['base', 'complete', 'master']
export const GOAL_LABEL: Record<Goal, string> = { base: 'Base', complete: 'Complete', master: 'Master' }
export const GOAL_HINT: Record<Goal, string> = {
  base: 'základní karty 1–oficiální počet',
  complete: 'všechny karty sady včetně secret',
  master: 'všechny karty ve všech variantách',
}
/** Popisek u čísla „chybí“ podle cíle. */
export const GOAL_MISSING: Record<Goal, string> = {
  base: 'chybí do kompletu',
  complete: 'chybí do kompletu včetně secret',
  master: 'chybí do master setu',
}

/** Výchozí cíl, když si uživatel žádný nevybral: base; u sad bez číslování complete. */
export const defaultGoal = (p: Progress): Goal => (p.base ? 'base' : 'complete')

/** Počítadlo zvoleného cíle; base u sady bez číslování spadne na complete. */
export function pickGoal(p: Progress, goal: Goal): Counter {
  return (goal === 'base' ? p.base : p[goal]) ?? p.complete
}

/** Další meta po zvoleném cíli, která ještě není hotová (base → complete → master); null = už nic. */
export function nextGoal(p: Progress, goal: Goal): (Counter & { kind: Goal }) | null {
  for (const g of GOALS.slice(GOALS.indexOf(goal) + 1)) {
    const c = pickGoal(p, g)
    if (c.owned < c.total) return { kind: g, ...c }
  }
  return null
}
