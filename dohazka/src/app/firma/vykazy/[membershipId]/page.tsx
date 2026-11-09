import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireCan } from '@/lib/org'
import { parsePeriod, dateColumnToKey, formatHours, parseDayKey, periodKeyForDay, periodRange, pragueDayKey } from '@/lib/date'
import { KIND_LABEL } from '@/lib/entry'
import { ddmmyyyy } from '@/lib/export/rows'
import { buildMonth, visibleRows } from '@/lib/month'

export const metadata: Metadata = { title: 'Výkaz člověka' }

const popisDne = (key: string) =>
  new Intl.DateTimeFormat('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric', timeZone: 'UTC' }).format(parseDayKey(key))

export default async function VykazClovekaPage({
  params,
  searchParams,
}: {
  params: Promise<{ membershipId: string }>
  searchParams: Promise<{ period?: string }>
}) {
  const ctx = await requireCan('viewOthersEntries')
  const { membershipId } = await params
  const dnes = pragueDayKey(new Date())
  const { period = periodKeyForDay(ctx.org.periodStartDay, dnes) } = await searchParams
  const parsed = parsePeriod(period)
  if (!parsed) notFound()

  const { fromKey, toKey } = periodRange(ctx.org.periodStartDay, parsed.year, parsed.month)
  // `orgId` v podmínce: id z adresy z cizí firmy se tváří, jako by neexistovalo.
  const clen = await prisma.membership.findFirst({
    where: { id: membershipId, orgId: ctx.org.id },
    select: {
      tracksFrom: true,
      user: { select: { name: true } },
      entries: {
        where: { day: { gte: parseDayKey(fromKey), lte: parseDayKey(toKey) } },
        orderBy: [{ day: 'asc' }, { createdAt: 'asc' }],
      },
    },
  })
  if (!clen) notFound()

  const { rows, totalHours, daysWorked } = buildMonth({
    fromKey,
    toKey,
    tracksFromKey: dateColumnToKey(clen.tracksFrom),
    entries: clen.entries.map((e) => ({
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
  const videt = visibleRows(rows, dnes)

  return (
    <main className="mx-auto w-full max-w-md px-4 py-6">
      <Link href={`/firma/vykazy?period=${period}`} className="text-sm text-muted hover:text-fg">
        ← Výkazy firmy
      </Link>
      <h1 className="mt-3 text-xl font-semibold">{clen.user.name}</h1>
      <p className="text-sm text-subtle">
        {ddmmyyyy(fromKey)} – {ddmmyyyy(toKey)}
      </p>

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

      {/* Jen ke čtení: cizí záznamy upravuje správce jinde (úprava cizích záznamů je zvláštní oprávnění). */}
      {videt.length === 0 ? (
        <p className="mt-5 text-sm text-muted">V tomto období zatím nejsou žádné dny.</p>
      ) : (
        <ul className="mt-5 space-y-2">
          {videt.map((r) => (
            <li
              key={r.dayKey}
              className={`flex items-start justify-between gap-3 rounded-panel border px-3 py-2 text-sm ${
                r.state === 'filled' ? 'border-line bg-card' : 'border-dashed border-line text-subtle'
              }`}
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
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
