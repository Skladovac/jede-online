import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { LEAD_TYPE_LABEL } from '@/lib/labels'

export const metadata = { title: 'Návštěvnost' }

const RANGES = { '7': 7, '30': 30, '90': 90 } as const
type Range = keyof typeof RANGES

const SECTION: Record<string, string> = {
  '': 'Úvod',
  nabidka: 'Nabídka a detaily',
  'odhad-nemovitosti-zdarma': 'Odhad ceny zdarma',
  'prodej-nemovitosti': 'Prodávám',
  'koupe-nemovitosti': 'Kupuji',
  'o-nas': 'O nás',
  kontakt: 'Kontakt',
}

const pragueDay = (offset = 0) => {
  const d = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague' }).format(new Date(Date.now() - offset * 86_400_000))
  return new Date(`${d}T00:00:00Z`)
}

export default async function TrafficPage({ searchParams }: { searchParams: Promise<{ dni?: string }> }) {
  const { dni } = await searchParams
  const range: Range = dni && dni in RANGES ? (dni as Range) : '30'
  const days = RANGES[range]
  const since = pragueDay(days - 1)

  const [daily, uniques, paths, sources, leads, listings] = await Promise.all([
    prisma.pageStat.groupBy({ by: ['day'], where: { day: { gte: since } }, _sum: { views: true } }),
    prisma.visitorDay.groupBy({ by: ['day'], where: { day: { gte: since } }, _count: true }),
    prisma.pageStat.groupBy({ by: ['path'], where: { day: { gte: since } }, _sum: { views: true } }),
    prisma.sourceStat.groupBy({ by: ['source'], where: { day: { gte: since } }, _sum: { visits: true } }),
    prisma.lead.findMany({ where: { createdAt: { gte: since }, status: { not: 'SPAM' } }, select: { type: true, listingId: true, createdAt: true } }),
    prisma.listing.findMany({ where: { status: { not: 'DRAFT' } }, select: { id: true, slug: true, title: true, locality: true, status: true } }),
  ])

  const viewsByDay = new Map(daily.map((d) => [d.day.toISOString(), d._sum.views ?? 0]))
  const visitorsByDay = new Map(uniques.map((u) => [u.day.toISOString(), u._count]))
  const leadsByDay = new Map<string, number>()
  for (const l of leads) {
    const k = new Date(`${new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague' }).format(l.createdAt)}T00:00:00Z`).toISOString()
    leadsByDay.set(k, (leadsByDay.get(k) ?? 0) + 1)
  }
  const rows = Array.from({ length: days }, (_, i) => {
    const d = pragueDay(i)
    const k = d.toISOString()
    return { day: d, views: viewsByDay.get(k) ?? 0, visitors: visitorsByDay.get(k) ?? 0, leads: leadsByDay.get(k) ?? 0 }
  })
  const totalVisitors = rows.reduce((s, r) => s + r.visitors, 0)
  const totalViews = rows.reduce((s, r) => s + r.views, 0)
  const maxVisitors = Math.max(1, ...rows.map((r) => r.visitors))

  const sections = new Map<string, number>()
  for (const p of paths) {
    const key = SECTION[p.path.split('/')[1] ?? ''] ?? 'Ostatní'
    sections.set(key, (sections.get(key) ?? 0) + (p._sum.views ?? 0))
  }
  const sourceRows = sources.map((s) => ({ name: s.source, visits: s._sum.visits ?? 0 })).sort((a, b) => b.visits - a.visits)
  const sourceTotal = Math.max(1, sourceRows.reduce((s, r) => s + r.visits, 0))

  const pathViews = new Map(paths.map((p) => [p.path, p._sum.views ?? 0]))
  const leadsByListing = new Map<string, number>()
  for (const l of leads) if (l.listingId) leadsByListing.set(l.listingId, (leadsByListing.get(l.listingId) ?? 0) + 1)
  const listingRows = listings
    .map((l) => ({ ...l, views: pathViews.get(`/nabidka/${l.slug}`) ?? 0, leads: leadsByListing.get(l.id) ?? 0 }))
    .sort((a, b) => b.views - a.views)

  const leadTypes = new Map<string, number>()
  for (const l of leads) leadTypes.set(LEAD_TYPE_LABEL[l.type], (leadTypes.get(LEAD_TYPE_LABEL[l.type]) ?? 0) + 1)
  const fmt = (d: Date) => d.toLocaleDateString('cs-CZ', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'numeric' })
  const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toLocaleString('cs-CZ', { maximumFractionDigits: 1 })} %` : '—')

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="label text-gold-deep">Návštěvnost</p>
          <h1 className="mt-2 font-serif text-4xl">Kdo chodí na web</h1>
          <p className="mt-2 max-w-2xl text-sm text-stone">
            Vlastní počítadlo bez cookies. Návštěvník = jeden prohlížeč za den. Roboti a administrace se nepočítají.
          </p>
        </div>
        <nav aria-label="Období" className="flex gap-2">
          {(Object.keys(RANGES) as Range[]).map((r) => (
            <Link
              key={r}
              href={r === '30' ? '/admin/navstevnost' : `/admin/navstevnost?dni=${r}`}
              className={`rounded-full border px-4 py-1.5 text-sm ${r === range ? 'border-ink bg-ink text-paper' : 'border-ink/15 bg-white hover:border-ink/40'}`}
            >
              {r} dní
            </Link>
          ))}
        </nav>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ['Návštěvníci', totalVisitors.toLocaleString('cs-CZ')],
          ['Zobrazení stránek', totalViews.toLocaleString('cs-CZ')],
          ['Poptávky', leads.length.toLocaleString('cs-CZ')],
          ['Poptávka na návštěvníka', pct(leads.length, totalVisitors)],
        ].map(([k, v]) => (
          <div key={k} className="border border-ink/10 bg-white p-5">
            <p className="text-sm text-stone">{k}</p>
            <p className="mt-1 font-serif text-4xl tabular-nums">{v}</p>
          </div>
        ))}
      </div>
      {leadTypes.size > 0 && (
        <p className="mt-3 text-sm text-stone">
          {[...leadTypes.entries()].map(([k, v]) => `${k}: ${v}`).join(' · ')}
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="border border-ink/10 bg-white p-5 sm:p-6">
          <h2 className="font-serif text-2xl">Odkud lidé přišli</h2>
          {sourceRows.length ? (
            <ul className="mt-4 space-y-2.5 text-sm">
              {sourceRows.map((s) => (
                <li key={s.name}>
                  <div className="flex justify-between gap-3">
                    <span className="truncate">{s.name}</span>
                    <span className="shrink-0 tabular-nums">
                      <strong>{s.visits}</strong> <span className="text-stone">({pct(s.visits, sourceTotal)})</span>
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 bg-paper-2">
                    <div className="h-full bg-gold" style={{ width: `${(s.visits / sourceTotal) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-stone">Zatím žádná data.</p>
          )}
        </section>

        <section className="border border-ink/10 bg-white p-5 sm:p-6">
          <h2 className="font-serif text-2xl">Části webu</h2>
          <ul className="mt-4 space-y-1 text-sm">
            {[...sections.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([k, v]) => (
                <li key={k} className="flex justify-between border-t border-ink/10 py-1.5">
                  <span>{k}</span>
                  <span className="font-semibold tabular-nums">{v}</span>
                </li>
              ))}
          </ul>
        </section>
      </div>

      <section className="mt-6 border border-ink/10 bg-white p-5 sm:p-6">
        <h2 className="font-serif text-2xl">Nemovitosti</h2>
        <p className="mt-1 text-sm text-stone">Zobrazení detailu a poptávky za vybrané období.</p>
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="text-left text-stone">
              <th className="py-1.5 font-medium">Nemovitost</th>
              <th className="py-1.5 text-right font-medium">Zobrazení</th>
              <th className="py-1.5 text-right font-medium">Poptávky</th>
            </tr>
          </thead>
          <tbody>
            {listingRows.map((l) => (
              <tr key={l.id} className="border-t border-ink/10">
                <td className="py-2 pr-3">
                  <Link href={`/admin/nemovitosti/${l.id}`} className="font-medium hover:text-gold-deep">
                    {l.title}
                  </Link>
                  <span className="text-stone">, {l.locality}</span>
                  {l.status === 'SOLD' && <span className="ml-2 text-xs text-stone">(prodáno)</span>}
                </td>
                <td className="py-2 text-right tabular-nums">{l.views}</td>
                <td className="py-2 text-right tabular-nums">{l.leads}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-6 border border-ink/10 bg-white p-5 sm:p-6">
        <h2 className="font-serif text-2xl">Po dnech</h2>
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="text-left text-stone">
              <th className="py-1.5 font-medium">Den</th>
              <th className="py-1.5 text-right font-medium">Návštěvníci</th>
              <th className="py-1.5 text-right font-medium">Zobrazení</th>
              <th className="py-1.5 text-right font-medium">Poptávky</th>
              <th className="w-2/5 py-1.5" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.day.toISOString()} className="border-t border-ink/10 tabular-nums">
                <td className="py-1.5">{fmt(r.day)}</td>
                <td className="py-1.5 text-right font-semibold">{r.visitors}</td>
                <td className="py-1.5 text-right">{r.views}</td>
                <td className="py-1.5 text-right">{r.leads || ''}</td>
                <td className="py-1.5 pl-4">
                  <div className="h-2 bg-ink" style={{ width: `${(r.visitors / maxVisitors) * 100}%` }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
