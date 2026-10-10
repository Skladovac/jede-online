import Link from 'next/link'

/**
 * Sdílené stavební prvky nového designu (collector dashboard): panel, nadpis sekce, statistika, štítek, tlačítka.
 * Barvy jsou z design tokenů (globals.css), takže fungují ve tmavém i světlém vzhledu.
 */

export const container = 'mx-auto w-full max-w-page px-4 sm:px-6'

/** Panel / karta: jednotné pozadí, rámeček a zaoblení. `interactive` = jemný hover (rámeček + posun o 2 px). */
export const panel = 'rounded-panel border border-line bg-card'
export const panelInteractive = `${panel} transition duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:bg-card-hover`

export const btnPrimary =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-panel bg-accent-strong px-5 py-2.5 font-semibold text-on-accent transition-colors duration-200 hover:bg-accent-hover'
export const btnSecondary =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-panel border border-line-strong bg-card px-5 py-2.5 font-semibold text-fg transition-colors duration-200 hover:bg-card-hover'
export const linkAccent = 'font-medium text-accent hover:underline'

export function SectionHeader({ title, href, linkLabel, sub }: { title: string; href?: string; linkLabel?: string; sub?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-fg sm:text-[28px]">{title}</h2>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {href && linkLabel && (
        <Link href={href} className={`${linkAccent} inline-flex min-h-11 items-center text-sm`}>
          {linkLabel} →
        </Link>
      )}
    </div>
  )
}

/** Malá statistika / KPI: popisek, hodnota (tabulkové číslice), případně doplněk. */
export function StatCard({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: 'positive' | 'warning' }) {
  const color = tone === 'positive' ? 'text-positive' : tone === 'warning' ? 'text-warning' : 'text-fg'
  return (
    <div className={`${panel} px-4 py-3.5`}>
      <p className="text-xs font-medium uppercase tracking-wide text-subtle">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${color}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted tabular-nums">{sub}</p>}
    </div>
  )
}

const BADGE = {
  accent: 'bg-accent-soft text-accent',
  positive: 'bg-[color-mix(in_srgb,var(--positive)_14%,transparent)] text-positive',
  warning: 'bg-[color-mix(in_srgb,var(--warning)_16%,transparent)] text-warning',
  neutral: 'bg-surface text-muted',
} as const

export function Badge({ tone = 'neutral', children }: { tone?: keyof typeof BADGE; children: React.ReactNode }) {
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${BADGE[tone]}`}>{children}</span>
}

/** Ukazatel postupu (vlastním / celkem) — zelený, s procenty i textem (nespoléhá jen na barvu). */
export function ProgressMeter({ owned, total, label }: { owned: number; total: number; label?: string }) {
  const pct = total ? (owned / total) * 100 : 0
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs tabular-nums text-muted">
        <span>
          {label ? `${label} ` : ''}
          <span className="font-semibold text-fg">{owned}</span> / {total}
        </span>
        <span>{pct.toLocaleString('cs-CZ', { maximumFractionDigits: 1 })} %</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={owned}>
        <div className="h-full rounded-full bg-positive" style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  )
}
