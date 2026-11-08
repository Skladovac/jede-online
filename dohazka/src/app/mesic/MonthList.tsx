import Link from 'next/link'
import { formatHours, parseDayKey } from '@/lib/date'
import type { MonthRow } from '@/lib/month'

const KIND_LABEL = { WORK: 'Práce', VACATION: 'Dovolená', SICK: 'Nemoc', DAYOFF: 'Nepracoval' } as const

// Hodnota dne je UTC půlnoc (parseDayKey), proto i formátování v UTC.
const popisDne = (key: string) =>
  new Intl.DateTimeFormat('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric', timeZone: 'UTC' }).format(parseDayKey(key))

const radek = 'flex items-start justify-between gap-3 rounded-panel border px-3 py-2 text-sm'

/** Seznam dnů období. Dny před začátkem zapisování se nevypisují; prázdné dny jsou jen tiše šedé. */
export function MonthList({ rows }: { rows: MonthRow[] }) {
  return (
    <ul className="mt-5 space-y-2">
      {rows
        .filter((r) => r.state !== 'before-start')
        .map((r) => (
          <li key={r.dayKey}>
            <Link
              href={`/den/${r.dayKey}`}
              className={
                r.state === 'filled'
                  ? `${radek} border-line bg-card hover:border-line-strong`
                  : `${radek} border-dashed border-line text-subtle hover:border-line-strong`
              }
            >
              <span className="w-20 shrink-0 font-medium first-letter:uppercase">{popisDne(r.dayKey)}</span>
              {r.state === 'filled' ? (
                <span className="min-w-0 flex-1 space-y-0.5">
                  {r.entries.map((e) => (
                    <span key={e.id} className="block truncate">
                      {KIND_LABEL[e.kind]}
                      {e.hours !== null && ` · ${formatHours(e.hours)} h`}
                      {(e.place || e.note) && <span className="text-muted"> · {[e.place, e.note].filter(Boolean).join(' · ')}</span>}
                    </span>
                  ))}
                </span>
              ) : (
                <span className="flex-1">—</span>
              )}
              {r.state === 'filled' && r.hours > 0 && <span className="shrink-0 font-medium">{formatHours(r.hours)} h</span>}
            </Link>
          </li>
        ))}
    </ul>
  )
}
