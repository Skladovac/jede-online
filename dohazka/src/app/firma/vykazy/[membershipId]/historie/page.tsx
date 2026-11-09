import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireCan } from '@/lib/org'
import { KIND_LABEL, type EntryKindValue } from '@/lib/entry'
import { ddmmyyyy } from '@/lib/export/rows'

export const metadata: Metadata = { title: 'Historie změn' }

type Snimek = { kind?: string; hours?: number | null; fromTime?: string | null; toTime?: string | null; place?: string | null; note?: string | null }

const popis = (s: unknown) => {
  if (!s || typeof s !== 'object') return '-'
  const e = s as Snimek
  const druh = e.kind && e.kind in KIND_LABEL ? KIND_LABEL[e.kind as EntryKindValue] : (e.kind ?? '')
  return [druh, e.hours != null && `${e.hours} h`, e.fromTime && e.toTime && `${e.fromTime}–${e.toTime}`, e.place, e.note].filter(Boolean).join(' · ')
}

const kdy = (d: Date) => new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Prague' }).format(d)

// Historie je jen tady: do výkazu, exportu ani PDF se nedostává. Účetní oprávnění nemá.
export default async function HistorieZmenPage({ params }: { params: Promise<{ membershipId: string }> }) {
  const ctx = await requireCan('viewChangeLog')
  const { membershipId } = await params
  // `orgId` v podmínce: id z adresy z cizí firmy se tváří, jako by neexistovalo.
  const clen = await prisma.membership.findFirst({ where: { id: membershipId, orgId: ctx.org.id }, select: { user: { select: { name: true } } } })
  if (!clen) notFound()
  const zmeny = await prisma.entryChangeLog.findMany({ where: { membershipId }, orderBy: { changedAt: 'desc' }, take: 200 })
  // changedById je jen id uživatele, jména se dohledají jedním dotazem.
  const ids = [...new Set(zmeny.map((z) => z.changedById))]
  const lide = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
  const jmeno = new Map(lide.map((u) => [u.id, u.name]))

  return (
    <main className="mx-auto w-full max-w-md px-4 py-6">
      <Link href={`/firma/vykazy/${membershipId}`} className="text-sm text-muted hover:text-fg">
        ← Výkaz člověka
      </Link>
      <h1 className="mt-3 text-xl font-semibold">Historie změn: {clen.user.name}</h1>
      {zmeny.length === 0 ? (
        <p className="mt-5 text-sm text-muted">Nikdo zatím nic neopravil.</p>
      ) : (
        <ul className="mt-5 space-y-2">
          {zmeny.map((z) => (
            <li key={z.id} className="rounded-panel border border-line bg-card px-3 py-2 text-sm">
              <p className="font-medium">{ddmmyyyy(z.dayKey)}</p>
              <p className="text-muted">Bylo: {popis(z.before)}</p>
              <p className="text-muted">Je: {popis(z.after)}</p>
              <p className="text-xs text-subtle">
                {jmeno.get(z.changedById) ?? 'Neznámý uživatel'} · {kdy(z.changedAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
