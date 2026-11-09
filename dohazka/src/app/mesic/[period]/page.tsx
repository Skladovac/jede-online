import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireOrgContext } from '@/lib/org'
import { parsePeriod, dateColumnToKey, formatHours, parseDayKey, periodKeyForDay, periodRange, pragueDayKey } from '@/lib/date'
import { buildMonth } from '@/lib/month'
import { MonthList } from '../MonthList'
import { SettingsLink } from '@/components/SettingsLink'

export const metadata: Metadata = { title: 'Měsíc' }

const klicMesice = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`
const posunMesic = (year: number, month: number, o: number) => {
  const i = year * 12 + (month - 1) + o
  return klicMesice(Math.floor(i / 12), (i % 12) + 1)
}
const nazevMesice = (year: number, month: number) =>
  new Intl.DateTimeFormat('cs-CZ', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1)))
const ddmm = (key: string) => {
  const [, m, d] = key.split('-').map(Number)
  return `${d}. ${m}.`
}

const EXPORTY = [
  { format: 'pdf', label: 'PDF' },
  { format: 'xlsx', label: 'Excel' },
  { format: 'csv', label: 'CSV' },
] as const

export default async function MesicPage({ params }: { params: Promise<{ period: string }> }) {
  const ctx = await requireOrgContext()
  const { period } = await params
  const p = parsePeriod(period)
  if (!p) notFound()
  const { year, month } = p

  const { fromKey, toKey } = periodRange(ctx.org.periodStartDay, year, month)
  // Vždy jen záznamy aktivního členství.
  const zapsane = await prisma.entry.findMany({
    where: { membershipId: ctx.membership.id, day: { gte: parseDayKey(fromKey), lte: parseDayKey(toKey) } },
    orderBy: [{ day: 'asc' }, { createdAt: 'asc' }],
  })

  const { rows, totalHours, daysWorked } = buildMonth({
    fromKey,
    toKey,
    // @db.Date přichází jako UTC půlnoc, proto UTC a ne pražský čas.
    tracksFromKey: dateColumnToKey(ctx.membership.tracksFrom),
    entries: zapsane.map((e) => ({
      id: e.id,
      dayKey: dateColumnToKey(e.day),
      kind: e.kind,
      hours: e.hours === null ? null : Number(e.hours),
      fromTime: e.fromTime,
      toTime: e.toTime,
      place: e.place,
      note: e.note,
    })),
  })

  // Období dneška podle nastavení firmy (při startDay 16 patří 20. 11. už k 2026-12).
  const dnesPeriod = periodKeyForDay(ctx.org.periodStartDay, pragueDayKey(new Date()))
  const odkaz = 'rounded-panel border border-line px-3 py-2 text-sm text-muted hover:border-line-strong'

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <SettingsLink />
      <nav className="flex items-center justify-between gap-2" aria-label="Přechod mezi měsíci">
        <Link href={`/mesic/${posunMesic(year, month, -1)}`} className={odkaz} aria-label="Předchozí měsíc">
          ←
        </Link>
        <div className="text-center">
          <h1 className="text-lg font-semibold first-letter:uppercase">{nazevMesice(year, month)}</h1>
          <p className="text-sm text-subtle">
            {ddmm(fromKey)} – {ddmm(toKey)}
          </p>
          {period !== dnesPeriod && (
            <Link href={`/mesic/${dnesPeriod}`} className="text-sm text-accent-strong underline">
              Tento měsíc
            </Link>
          )}
        </div>
        <Link href={`/mesic/${posunMesic(year, month, 1)}`} className={odkaz} aria-label="Další měsíc">
          →
        </Link>
      </nav>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-panel border border-line bg-card px-3 py-3">
          <p className="text-2xl font-semibold">{formatHours(totalHours)}</p>
          <p className="text-sm text-muted">hodin</p>
        </div>
        <div className="rounded-panel border border-line bg-card px-3 py-3">
          <p className="text-2xl font-semibold">{daysWorked}</p>
          <p className="text-sm text-muted">odpracovaných dnů</p>
        </div>
      </div>

      <MonthList rows={rows} />

      <div className="mt-6 grid grid-cols-3 gap-2" aria-label="Export výkazu">
        {EXPORTY.map((x) => (
          <a
            key={x.format}
            href={`/api/export/${x.format}?period=${period}`}
            className="rounded-panel border border-line-strong bg-card px-3 py-2 text-center text-sm font-medium hover:bg-card-hover"
          >
            {x.label}
          </a>
        ))}
      </div>
    </main>
  )
}
