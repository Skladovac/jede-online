import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireCan } from '@/lib/org'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/role'
import { parsePeriod, periodKeyForDay, periodRange, pragueDayKey } from '@/lib/date'
import { loadCompanyPeople } from '@/lib/company-data'
import { buildCompanyReport, dayShort } from '@/lib/company-report'
import { LockButton } from './LockButton'

export const metadata: Metadata = { title: 'Výkazy firmy' }

const klicMesice = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`
const posunMesic = (year: number, month: number, o: number) => {
  const i = year * 12 + (month - 1) + o
  return klicMesice(Math.floor(i / 12), (i % 12) + 1)
}
const nazevMesice = (year: number, month: number) =>
  new Intl.DateTimeFormat('cs-CZ', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1)))

const EXPORTY = [
  { format: 'xlsx', label: 'Excel' },
  { format: 'csv', label: 'CSV' },
] as const

export default async function VykazyFirmyPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const ctx = await requireCan('viewOthersEntries')
  const dnes = pragueDayKey(new Date())
  const dnesPeriod = periodKeyForDay(ctx.org.periodStartDay, dnes)
  const { period = dnesPeriod } = await searchParams
  const parsed = parsePeriod(period)
  if (!parsed) notFound()
  const { year, month } = parsed

  const { fromKey, toKey } = periodRange(ctx.org.periodStartDay, year, month)
  const [lide, zamky] = await Promise.all([
    loadCompanyPeople(ctx.org.id, fromKey, toKey),
    prisma.periodLock.findMany({ where: { orgId: ctx.org.id }, select: { periodKey: true } }),
  ])
  // Období zobrazené stránkou je klíč RRRR-MM (parsePeriod ho ověřil), takže se hledá přímo v seznamu.
  const uzavreno = zamky.some((z) => z.periodKey === period)
  const smiOtevrit = ctx.role === 'OWNER' || ctx.isSuperAdmin
  const report = buildCompanyReport({
    orgName: ctx.org.reportName,
    fromKey,
    toKey,
    people: lide.map((l) => ({ personName: l.personName, month: l.month, trackGaps: l.trackGaps })),
  })
  // Pořadí řádků přehledu je pořadí `lide`, takže se dají spojit podle indexu.
  const radky = report.rows.map((r, i) => ({ ...r, membershipId: lide[i].membershipId, active: lide[i].active }))
  const bezZapisu = radky.filter((r) => r.missingDays.length > 0)

  const odkaz = 'rounded-panel border border-line px-3 py-2 text-sm text-muted hover:border-line-strong'
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6">
      <Link href="/nastaveni" className="text-sm text-muted hover:text-fg">
        ← Nastavení
      </Link>
      <h1 className="mt-3 text-xl font-semibold">Výkazy firmy {ctx.org.name}</h1>

      <nav className="mt-4 flex items-center justify-between gap-2" aria-label="Přechod mezi měsíci">
        <Link href={`/firma/vykazy?period=${posunMesic(year, month, -1)}`} className={odkaz} aria-label="Předchozí měsíc">
          ←
        </Link>
        <div className="text-center">
          <p className="text-lg font-semibold first-letter:uppercase">{nazevMesice(year, month)}</p>
          {period !== dnesPeriod && (
            <Link href={`/firma/vykazy?period=${dnesPeriod}`} className="text-sm text-accent-strong underline">
              Tento měsíc
            </Link>
          )}
        </div>
        <Link href={`/firma/vykazy?period=${posunMesic(year, month, 1)}`} className={odkaz} aria-label="Další měsíc">
          →
        </Link>
      </nav>

      {(can(ctx.role, 'lockPeriod', ctx.isSuperAdmin) || uzavreno) && (
        <section className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-panel border border-line bg-card p-4" aria-label="Uzávěrka měsíce">
          <p className="text-sm">{uzavreno ? <strong>Měsíc je uzavřený, záznamy v něm nejdou měnit.</strong> : <span className="text-muted">Měsíc je otevřený.</span>}</p>
          {can(ctx.role, 'lockPeriod', ctx.isSuperAdmin) && <LockButton period={period} locked={uzavreno} canUnlock={smiOtevrit} />}
        </section>
      )}

      <section className="mt-5 rounded-panel border border-line bg-card p-4" aria-label="Dny bez záznamu">
        <h2 className="font-semibold">Dny bez záznamu</h2>
        {bezZapisu.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Nikdo nemá za uplynulé dny období žádný den bez záznamu.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {bezZapisu.map((r) => (
              <li key={r.membershipId}>
                <Link href={`/firma/vykazy/${r.membershipId}?period=${period}`} className="font-medium underline">
                  {r.personName}
                </Link>
                <span className="text-muted">
                  {' '}
                  — {r.missingDays.length} {r.missingDays.length === 1 ? 'den' : r.missingDays.length < 5 ? 'dny' : 'dní'}: {r.missingDays.map(dayShort).join(', ')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-5" aria-label="Hodiny podle lidí">
        {radky.length === 0 ? (
          <p className="text-sm text-muted">Ve firmě zatím nejsou žádní lidé.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th className="py-2 font-medium">Jméno</th>
                <th className="py-2 text-right font-medium">Hodin</th>
                <th className="py-2 text-right font-medium">Dnů</th>
              </tr>
            </thead>
            <tbody>
              {radky.map((r) => (
                <tr key={r.membershipId} className="border-b border-line">
                  <td className="py-2">
                    <Link href={`/firma/vykazy/${r.membershipId}?period=${period}`} className="underline">
                      {r.personName}
                    </Link>
                    {!r.active && <span className="text-subtle"> (neaktivní)</span>}
                  </td>
                  <td className="py-2 text-right">{r.totalHours}</td>
                  <td className="py-2 text-right">{r.daysWorked}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td className="py-2">Celkem</td>
                <td className="py-2 text-right">{report.totalHours}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        )}
      </section>

      {can(ctx.role, 'exportCompany', ctx.isSuperAdmin) && (
        <div className="mt-6 grid grid-cols-2 gap-2" aria-label="Export výkazu firmy">
          {EXPORTY.map((x) => (
            <a
              key={x.format}
              href={`/api/export/firma/${x.format}?period=${period}`}
              className="rounded-panel border border-line-strong bg-card px-3 py-2 text-center text-sm font-medium hover:bg-card-hover"
            >
              {x.label}
            </a>
          ))}
        </div>
      )}
    </main>
  )
}
