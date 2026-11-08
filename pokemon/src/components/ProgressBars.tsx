import type { Goal, Progress } from '@/lib/goal'
import { getT } from '@/lib/i18n/server'

const ROWS = [
  ['base', 'Base', 'základní karty 1–oficiální počet', 'bg-gradient-to-r from-brand-blue to-brand-blue-dark dark:from-accent dark:to-brand-blue'],
  ['complete', 'Complete', 'všechny karty sady včetně secret', 'bg-[var(--ink)] dark:bg-white'],
  ['master', 'Master', 'všechny karty ve všech variantách', 'bg-brand-yellow'],
] as const

/** Tři postupy sady vedle sebe (base / complete / master). compact = jeden řádek pro výpis sad. */
export async function ProgressBars({ p, compact = false, active }: { p: Progress; compact?: boolean; active?: Goal }) {
  const t = await getT()
  const rows = ROWS.filter(([k]) => p[k])
  if (compact)
    return (
      <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-subtle">
        {rows.map(([k, label, , color]) => {
          const v = p[k]!
          return (
            <span key={k} className="inline-flex items-center gap-1" title={label}>
              <span className={`h-2 w-2 rounded-full ${color}`} />
              <span className={active === k ? 'font-semibold text-fg' : undefined}>
                {label} {v.owned}/{v.total}
              </span>
            </span>
          )
        })}
      </span>
    )
  return (
    <div className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
      {rows.map(([k, label, hint, color]) => {
        const v = p[k]!
        const pct = v.total ? Math.round((v.owned / v.total) * 100) : 0
        return (
          <div key={k} title={t(hint)}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-semibold text-fg">
                {label}
                {active === k && <span className="ml-1.5 rounded-full bg-[rgba(255,203,5,0.22)] px-1.5 py-0.5 text-[10.5px] font-semibold text-fg">{t('můj cíl')}</span>}
              </span>
              <span className={`font-mono text-[12.5px] ${pct >= 100 ? 'text-positive' : 'text-muted'}`}>
                {v.owned} / {v.total} · {pct} %
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
              <div className={`h-full rounded-full ${pct >= 100 ? 'bg-positive' : color}`} style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1.5 text-[11.5px] text-subtle">{t(hint)}</p>
          </div>
        )
      })}
    </div>
  )
}
