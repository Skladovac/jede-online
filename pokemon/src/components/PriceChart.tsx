import { prisma } from '@/lib/prisma'
import { eurCzkRate } from '@/lib/fx'
import { getLocale, getT } from '@/lib/i18n/server'
import { LOCALE_INFO } from '@/lib/i18n/config'
import type { PriceStats } from '@/lib/price-stats'

type Point = { day: Date; eur: number }

/**
 * Graf ceny karty. Historie se ukládá každou noc (jen při změně ceny); dokud je bodů málo,
 * ukážeme odhad z průměrů Cardmarketu (30 dní → 7 dní → 1 den → dnešní trend).
 */
export async function PriceChart({ cardId, stats }: { cardId: string; stats: PriceStats | null }) {
  const [t, locale] = [await getT(), await getLocale()]
  const rows = await prisma.cardPrice.findMany({
    where: { cardId, day: { gte: new Date(Date.now() - 365 * 86_400_000) } },
    orderBy: { day: 'asc' },
    select: { day: true, eur: true },
  })
  let points: Point[] = rows.filter((r) => r.eur != null).map((r) => ({ day: r.day, eur: Number(r.eur) }))
  let estimate = false
  if (points.length < 3 && stats) {
    const now = Date.now()
    const est = [
      [30, stats.avg30],
      [7, stats.avg7],
      [1, stats.avg1],
      [0, stats.trend],
    ] as const
    const p = est.filter(([, v]) => v != null && v > 0).map(([d, v]) => ({ day: new Date(now - d * 86_400_000), eur: Number(v) }))
    if (p.length >= 2) {
      points = p
      estimate = true
    }
  }
  if (points.length < 2) return null
  // Poslední bod = dnes (cena se od poslední změny nehnula).
  if (!estimate && points[points.length - 1].day.getTime() < Date.now() - 86_400_000)
    points.push({ day: new Date(), eur: points[points.length - 1].eur })

  const rate = eurCzkRate() ?? 25
  const W = 600
  const H = 150
  const t0 = points[0].day.getTime()
  const t1 = points[points.length - 1].day.getTime()
  const vals = points.map((p) => p.eur)
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const span = Math.max(max - min, max * 0.05, 0.01)
  const x = (d: Date) => ((d.getTime() - t0) / Math.max(t1 - t0, 1)) * (W - 8) + 4
  const y = (v: number) => H - 10 - ((v - min) / span) * (H - 28)
  // Schodovitá čára (cena platí, dokud se nezmění); u odhadu rovné spojnice.
  const d = points
    .map((p, i) => (i === 0 ? `M${x(p.day)},${y(p.eur)}` : estimate ? `L${x(p.day)},${y(p.eur)}` : `H${x(p.day)} V${y(p.eur)}`))
    .join(' ')
  const up = vals[vals.length - 1] >= vals[0]
  const change = ((vals[vals.length - 1] - vals[0]) / vals[0]) * 100
  const fmtDay = (dt: Date) => dt.toLocaleDateString(LOCALE_INFO[locale].intl, { day: 'numeric', month: 'numeric' })
  const fmt = (v: number) => `${v.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € (${Math.round(v * rate).toLocaleString('cs-CZ')} Kč)`

  return (
    <div className="mt-5 border-t border-line pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">{t('Vývoj ceny')}</p>
        <p className={`text-sm font-semibold ${up ? 'text-green-700 dark:text-green-400' : 'text-red-600'}`}>
          {change >= 0 ? '+' : ''}
          {change.toFixed(0)} %
        </p>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 h-36 w-full" role="img" aria-label={t('Vývoj ceny')}>
        <path
          d={`${d} L${x(points[points.length - 1].day)},${H} L${x(points[0].day)},${H} Z`}
          className={up ? 'fill-green-500/10' : 'fill-red-500/10'}
        />
        <path d={d} fill="none" strokeWidth="2.5" strokeDasharray={estimate ? '6 4' : undefined} className={up ? 'stroke-green-500' : 'stroke-red-500'} />
      </svg>
      <div className="flex justify-between text-xs text-subtle">
        <span>
          {fmtDay(points[0].day)}: {fmt(vals[0])}
        </span>
        <span>
          {fmtDay(points[points.length - 1].day)}: {fmt(vals[vals.length - 1])}
        </span>
      </div>
      {estimate && (
        <p className="mt-1 text-xs text-subtle">
          {t('Odhad z průměrů Cardmarketu (30 dní, 7 dní, 1 den, dnes). Přesná historie se ukládá každý den.')}
        </p>
      )}
    </div>
  )
}
