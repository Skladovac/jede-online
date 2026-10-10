import Link from 'next/link'

/**
 * Sdílené stavební prvky designu (Pokémon TCG fan web): panel, nadpis sekce, statistika, štítek, tlačítka, Pokéball.
 * Barvy jsou z design tokenů (globals.css), takže fungují ve tmavém i světlém vzhledu.
 */

export const container = 'mx-auto w-full max-w-page px-4 sm:px-6'

/** Panel / karta: jednotné pozadí, rámeček a zaoblení. `interactive` = jemný hover (rámeček + posun o 2 px). */
export const panel = 'rounded-panel border border-line bg-card shadow-soft'
export const panelInteractive = `${panel} transition duration-200 hover:-translate-y-0.5 hover:border-line-hover`

/** Hlavní CTA: Pokémon žlutá s tmavě modrým textem (kontrast). */
export const btnPrimary =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-[11px] bg-accent-strong px-5 py-2.5 font-bold text-on-accent shadow-sm transition-colors duration-200 hover:bg-accent-hover'
/** Sekundární: modré tlačítko. */
export const btnBlue =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-[11px] bg-brand-blue px-5 py-2.5 font-semibold text-white transition-colors duration-200 hover:bg-brand-blue-dark'
/** Obrys: bílé/průhledné s modrým okrajem. */
export const btnSecondary =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-[11px] border-2 border-brand-blue bg-card px-5 py-2.5 font-semibold text-brand-blue transition-colors duration-200 hover:bg-accent-soft dark:border-accent dark:bg-transparent dark:text-accent'
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
  blue: 'bg-brand-blue text-white',
  yellow: 'bg-brand-yellow text-brand-blue-deep',
  green: 'bg-[#22a06b] text-white',
  red: 'bg-brand-red text-white',
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
        <span>{pct >= 100 ? '✓ ' : ''}{pct.toLocaleString('cs-CZ', { maximumFractionDigits: 1 })} %</span>
      </div>
      {/* Modrý podklad, žlutý postup; hotová sada zeleně (a s ✓, ne jen barvou). */}
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--pokemon-blue)_16%,transparent)]" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={owned}>
        <div className={`h-full rounded-full ${pct >= 100 ? 'bg-positive' : 'bg-brand-yellow'}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  )
}

/**
 * Pokéball jako jemný geometrický motiv (jen obrys, čisté SVG). Barva z `currentColor`, průhlednost řeší rodič.
 */
export function Pokeball({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} fill="none" stroke="currentColor" aria-hidden focusable="false">
      <circle cx="100" cy="100" r="94" strokeWidth="6" />
      <path d="M6 100h62M132 100h62" strokeWidth="6" />
      <circle cx="100" cy="100" r="30" strokeWidth="6" />
      <circle cx="100" cy="100" r="14" strokeWidth="5" />
    </svg>
  )
}

/** Prázdný stav: jemný Pokéball, krátký text, případně akce. */
export function EmptyState({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col items-center gap-3 rounded-panel border border-dashed border-line-strong bg-card px-6 py-10 text-center text-muted ${className}`}>
      <Pokeball className="h-12 w-12 text-brand-blue opacity-30 dark:text-accent" />
      <div className="max-w-md text-sm leading-relaxed">{children}</div>
    </div>
  )
}
