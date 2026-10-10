import type { Progress } from '@/lib/progress'
import { getT } from '@/lib/i18n/server'

const ROWS = [
  ['base', 'Base', 'základní karty 1–oficiální počet', 'bg-green-500'],
  ['complete', 'Complete', 'všechny karty sady včetně secret', 'bg-blue-500'],
  ['master', 'Master', 'všechny karty ve všech variantách', 'bg-purple-500'],
] as const

/** Tři postupy sady vedle sebe (base / complete / master). compact = jeden řádek pro výpis sad. */
export async function ProgressBars({ p, compact = false }: { p: Progress; compact?: boolean }) {
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
              {label} {v.owned}/{v.total}
            </span>
          )
        })}
      </span>
    )
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {rows.map(([k, label, hint, color]) => {
        const v = p[k]!
        const pct = v.total ? Math.round((v.owned / v.total) * 100) : 0
        return (
          <div key={k} title={t(hint)} className="rounded-xl border border-line bg-card px-3 py-2">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-semibold">{label}</span>
              <span className="text-subtle">
                {v.owned}/{v.total} · {pct} %
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface">
              <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1 text-[11px] text-subtle">{t(hint)}</p>
          </div>
        )
      })}
    </div>
  )
}
