import type { PriceStats } from '@/lib/price-stats'
import { formatEur } from '@/lib/format'
const ROWS: [keyof PriceStats, string, string?][] = [
  ['low', 'Nejlevnější nabídka', 'od'],
  ['trend', 'Cenový trend'],
  ['avg30', 'Průměr za 30 dní'],
  ['avg7', 'Průměr za 7 dní'],
  ['avg1', 'Průměr za 1 den'],
]

/** Přehled cen z Cardmarketu jako na jejich stránce karty (nejlevnější, trend, průměry). */
export function PriceStatsTable({ stats, title }: { stats: PriceStats | null; title?: string }) {
  const rows = ROWS.filter(([k]) => typeof stats?.[k] === 'number')
  if (!rows.length) return null
  return (
    <div>
      {title && <p className="mb-1 text-xs font-semibold text-slate-500">{title}</p>}
      <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 text-sm">
        {rows.map(([k, label, prefix]) => (
          <div key={k} className="contents">
            <dt className="text-slate-500">{label}</dt>
            <dd className={`text-right tabular-nums ${k === 'trend' ? 'font-bold' : ''}`}>
              {prefix ? `${prefix} ` : ''}
              {formatEur(stats![k] as number)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
