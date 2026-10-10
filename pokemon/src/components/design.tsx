import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'

/**
 * Sdílené stavební prvky designu „Sběratelská galerie“: panel, nadpis sekce, statistika, štítek, tlačítka, Pokéball.
 * Tlačítka: žluté (hlavní akce, na obrazovce nejvýš jedno), inkoustové (důležitá akce), obrysové (vedlejší).
 * Barvy jsou z design tokenů (globals.css), takže fungují ve tmavém i světlém vzhledu.
 */

export const container = 'mx-auto w-full max-w-page px-4 sm:px-6'

/** Panel / karta: jednotné pozadí, rámeček a zaoblení. `interactive` = jemný hover (rámeček + posun o 2 px). */
export const panel = 'rounded-[18px] border border-line bg-card shadow-soft'
export const panelInteractive = `${panel} transition duration-200 hover:-translate-y-0.5 hover:border-line-hover`

const btnBase =
  'inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-5 py-2.5 font-bold transition duration-200 active:translate-y-px [&_svg]:h-[18px] [&_svg]:w-[18px]'
/** Hlavní akce: Pokémon žlutá s inkoustovým textem. */
export const btnPrimary = `${btnBase} bg-accent-strong text-on-accent shadow-[inset_0_-2px_0_rgba(0,0,0,0.12),0_6px_16px_-8px_rgba(242,183,0,0.9)] hover:bg-accent-hover`
/** Důležitá akce bez žluté: inkoust (ve tmavém režimu světlé). */
export const btnBlue = `${btnBase} bg-[var(--ink)] text-white shadow-[0_6px_16px_-6px_rgba(14,27,46,0.55)] hover:bg-[#1b2c45] dark:bg-white dark:text-[var(--ink)] dark:hover:bg-[#e6ebf3]`
export const btnInk = btnBlue
/** Vedlejší: obrys. */
export const btnSecondary = `${btnBase} bg-transparent font-semibold text-fg shadow-[inset_0_0_0_1px_var(--border-strong)] hover:bg-card`
export const linkAccent = 'font-semibold text-accent hover:underline underline-offset-4'

export function SectionHeader({ title, href, linkLabel, sub }: { title: string; href?: string; linkLabel?: string; sub?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
      <div>
        <h2 className="text-2xl font-bold text-fg sm:text-[28px]">{title}</h2>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {href && linkLabel && (
        <Link href={href} className="group inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-accent">
          {linkLabel}
          <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
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
      <p className="eyebrow !text-[10.5px]">{label}</p>
      <p className={`mt-1.5 font-display text-[26px] font-bold leading-tight tabular-nums ${color}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted tabular-nums">{sub}</p>}
    </div>
  )
}

// Tlumené štítky jednoho stylu (tónovaná plocha + jemný obrys), žádné plné křiklavé barvy.
const BADGE = {
  accent: 'bg-accent-soft text-accent ring-[color-mix(in_srgb,var(--accent)_25%,transparent)]',
  blue: 'bg-[#e8f0fa] text-[#1d4e89] ring-[#cadcf2] dark:bg-[rgba(42,117,187,0.18)] dark:text-[#9cc8ff] dark:ring-[rgba(42,117,187,0.38)]',
  yellow: 'bg-[#fff6d6] text-[#7a5600] ring-[#f5e19a] dark:bg-[rgba(255,203,5,0.12)] dark:text-[#ffd95c] dark:ring-[rgba(255,203,5,0.3)]',
  green: 'bg-[#e8f5ee] text-[#146c46] ring-[#c9e9d7] dark:bg-[rgba(31,138,91,0.16)] dark:text-[#7ee0ad] dark:ring-[rgba(31,138,91,0.35)]',
  red: 'bg-[#fdecea] text-[#b42318] ring-[#f6cfca] dark:bg-[rgba(216,52,26,0.16)] dark:text-[#ff9b8a] dark:ring-[rgba(216,52,26,0.35)]',
  positive: 'bg-[color-mix(in_srgb,var(--positive)_12%,transparent)] text-positive ring-[color-mix(in_srgb,var(--positive)_25%,transparent)]',
  warning: 'bg-[color-mix(in_srgb,var(--warning)_14%,transparent)] text-warning ring-[color-mix(in_srgb,var(--warning)_25%,transparent)]',
  neutral: 'bg-surface text-muted ring-line',
} as const

export function Badge({ tone = 'neutral', children }: { tone?: keyof typeof BADGE; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-[7px] px-2 py-0.5 text-[12px] font-semibold ring-1 ring-inset [&_svg]:h-3 [&_svg]:w-3 ${BADGE[tone]}`}>{children}</span>
  )
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
        <span className={`inline-flex items-center gap-1 font-mono ${pct >= 100 ? 'text-positive' : ''}`}>
          {pct >= 100 && <Check className="h-3.5 w-3.5" strokeWidth={2.6} aria-hidden />}
          {pct.toLocaleString('cs-CZ', { maximumFractionDigits: 1 })} %
        </span>
      </div>
      {/* Modrý postup na jemné lince; hotová sada zeleně (a s fajfkou, ne jen barvou). */}
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={owned}>
        <div className={`h-full rounded-full ${pct >= 100 ? 'bg-positive' : 'bg-gradient-to-r from-brand-blue to-brand-blue-dark dark:from-accent dark:to-brand-blue'}`} style={{ width: `${Math.min(100, pct)}%` }} />
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
    <div className={`flex flex-col items-center gap-3 rounded-[18px] border border-dashed border-line-strong bg-surface px-6 py-12 text-center text-muted ${className}`}>
      <Pokeball className="h-12 w-12 text-fg opacity-15" />
      <div className="max-w-md text-sm leading-relaxed">{children}</div>
    </div>
  )
}
