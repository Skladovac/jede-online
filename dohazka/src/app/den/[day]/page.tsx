import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'
import { dateColumnToKey, formatHours, parseDayKey, periodKeyForDay, pragueDayKey } from '@/lib/date'
import { KIND_LABEL } from '@/lib/entry'
import { recentPlaces } from '@/lib/places'
import { DayForm, DeleteEntryButton } from '../DayForm'
import { SettingsLink } from '@/components/SettingsLink'

export const metadata: Metadata = { title: 'Zápis dne' }

const DEN = 86_400_000

const posun = (key: string, dny: number) => new Date(parseDayKey(key).getTime() + dny * DEN).toISOString().slice(0, 10)
const popisDne = (key: string) =>
  new Intl.DateTimeFormat('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    parseDayKey(key),
  )

export default async function DenPage({ params }: { params: Promise<{ day: string }> }) {
  const user = await requireUser()
  const { day } = await params
  // Tvar i existence data: 2026-02-31 by parseDayKey tiše přetočil, proto kontrola převodem zpět.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || posun(day, 0) !== day) notFound()

  const [zapsane, posledni] = await Promise.all([
    prisma.entry.findMany({ where: { userId: user.id, day: parseDayKey(day) }, orderBy: { createdAt: 'asc' } }),
    prisma.entry.findMany({
      where: { userId: user.id, place: { not: null } },
      orderBy: { day: 'desc' },
      take: 60,
      select: { place: true, day: true },
    }),
  ])
  const mista = recentPlaces(posledni.map((e) => ({ place: e.place, day: dateColumnToKey(e.day) })))
  const dnes = pragueDayKey(new Date())
  const odkaz = 'rounded-panel border border-line px-3 py-2 text-sm text-muted hover:border-line-strong'

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <div className="mb-2 flex items-center justify-between">
        <Link
          href={`/mesic/${periodKeyForDay(user.periodStartDay, day)}`}
          className="flex min-h-11 items-center px-1 text-sm text-accent-strong underline"
        >
          Měsíc a export
        </Link>
        <SettingsLink />
      </div>
      <nav className="flex items-center justify-between gap-2" aria-label="Přechod mezi dny">
        <Link href={`/den/${posun(day, -1)}`} className={odkaz} aria-label="Předchozí den">
          ←
        </Link>
        <div className="text-center">
          <h1 className="text-lg font-semibold first-letter:uppercase">{popisDne(day)}</h1>
          {day !== dnes && (
            <Link href={`/den/${dnes}`} className="text-sm text-accent-strong underline">
              Dnes
            </Link>
          )}
        </div>
        <Link href={`/den/${posun(day, 1)}`} className={odkaz} aria-label="Další den">
          →
        </Link>
      </nav>

      {zapsane.length > 0 && (
        <ul className="mt-5 space-y-2">
          {zapsane.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 rounded-panel border border-line bg-card px-3 py-2">
              <div className="min-w-0 text-sm">
                <p className="font-medium">
                  {KIND_LABEL[e.kind]}
                  {e.hours !== null && ` · ${formatHours(Number(e.hours))} h`}
                  {e.fromTime && e.toTime && <span className="font-normal text-muted"> ({e.fromTime}–{e.toTime})</span>}
                </p>
                {(e.place || e.note) && <p className="truncate text-muted">{[e.place, e.note].filter(Boolean).join(' · ')}</p>}
              </div>
              <DeleteEntryButton id={e.id} />
            </li>
          ))}
        </ul>
      )}

      <DayForm key={day} day={day} places={mista} hasEntries={zapsane.length > 0} hasWorkOrLeave={zapsane.some((e) => e.kind !== 'DAYOFF')} />
    </main>
  )
}
