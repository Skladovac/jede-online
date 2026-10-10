import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin'

const DAYS = 30

type Row = { d: string; n: bigint | number }

/** Počty po dnech (pražský čas) za posledních 30 dní. Názvy tabulek a sloupců jsou pevné, žádný vstup od uživatele. */
async function perDay(table: string, column: string, where = '', count = 'count(*)') {
  const rows = await prisma.$queryRawUnsafe<Row[]>(
    `SELECT to_char(("${column}" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Prague', 'YYYY-MM-DD') AS d, ${count} AS n
     FROM "${table}" WHERE "${column}" >= now() - interval '${DAYS} days' ${where ? `AND ${where}` : ''} GROUP BY 1`,
  )
  return new Map(rows.map((r) => [r.d, Number(r.n)]))
}

function pragueDays() {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague' })
  return Array.from({ length: DAYS }, (_, i) => fmt.format(new Date(Date.now() - (DAYS - 1 - i) * 86_400_000)))
}

/** Malý sloupcový graf (SVG) s posledními 30 dny. */
function Bars({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(1, ...values)
  const w = 300
  const h = 56
  const bw = w / values.length
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-14 w-full" preserveAspectRatio="none" aria-hidden>
      {values.map((v, i) => {
        const bh = v ? Math.max(2, (v / max) * (h - 2)) : 0
        return <rect key={i} x={i * bw + 1} y={h - bh} width={bw - 2} height={bh} rx={1.5} fill={color} />
      })}
    </svg>
  )
}

export default async function AdminGrowth() {
  // Kontrola i na stránce, ne jen v layoutu.
  await requireAdmin()
  const days = pragueDays()
  const [regs, visitors, logins, added, offers, wants, trades, ratings, totalUsers, users30ago, wau, mau] = await Promise.all([
    perDay('User', 'createdAt'),
    // VisitorDay má jen datum (bez času) — počítáme unikátní návštěvníky po dnech zvlášť.
    prisma.visitorDay.groupBy({ by: ['day'], where: { day: { gte: new Date(Date.now() - DAYS * 86_400_000) } }, _count: true }),
    perDay('Session', 'createdAt', '', 'count(DISTINCT "userId")'),
    perDay('CollectionItem', 'createdAt'),
    perDay('CollectionItem', 'offeredAt', '"offerType" IS NOT NULL'),
    perDay('WantItem', 'createdAt'),
    perDay('TradeRequest', 'updatedAt', `"status" = 'COMPLETED'`),
    perDay('Rating', 'createdAt'),
    prisma.user.count({ where: { bannedAt: null } }),
    prisma.user.count({ where: { bannedAt: null, createdAt: { lt: new Date(Date.now() - DAYS * 86_400_000) } } }),
    prisma.session.groupBy({ by: ['userId'], where: { createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) } } }),
    prisma.session.groupBy({ by: ['userId'], where: { createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } } }),
  ])
  const visitorMap = new Map(visitors.map((v) => [v.day.toISOString().slice(0, 10), v._count]))

  const series = [
    { label: 'Registrace', map: regs, color: '#818cf8' },
    { label: 'Unikátní návštěvníci', map: visitorMap, color: '#60a5fa' },
    { label: 'Přihlášení (uživatelé)', map: logins, color: '#a78bfa' },
    { label: 'Přidané karty do sbírek', map: added, color: '#34d399' },
    { label: 'Nové nabídky', map: offers, color: '#38bdf8' },
    { label: 'Nové „chybí mi“', map: wants, color: '#fbbf24' },
    { label: 'Dokončené výměny', map: trades, color: '#4ade80' },
    { label: 'Hodnocení', map: ratings, color: '#f472b6' },
  ].map((s) => {
    const values = days.map((d) => s.map.get(d) ?? 0)
    const last7 = values.slice(-7).reduce((a, b) => a + b, 0)
    const prev7 = values.slice(-14, -7).reduce((a, b) => a + b, 0)
    return { ...s, values, total: values.reduce((a, b) => a + b, 0), last7, prev7 }
  })
  const visitors30 = series[1].total
  const growth = users30ago ? Math.round(((totalUsers - users30ago) / users30ago) * 100) : null

  const Kpi = ({ label, value, sub }: { label: string; value: string | number; sub?: string }) => (
    <div className="rounded-panel border border-line bg-card p-4">
      <p className="text-xs text-subtle">{label}</p>
      <p className="text-2xl font-black tabular-nums">{typeof value === 'number' ? value.toLocaleString('cs-CZ') : value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  )
  const trend = (a: number, b: number) => {
    if (!a && !b) return { text: '–', cls: 'text-subtle' }
    if (!b) return { text: 'nově', cls: 'text-positive' }
    const p = Math.round(((a - b) / b) * 100)
    return { text: `${p > 0 ? '+' : ''}${p} %`, cls: p > 0 ? 'text-positive' : p < 0 ? 'text-danger' : 'text-subtle' }
  }
  const fmtDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' })

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Růst webu</h1>
        <p className="mt-1 text-sm text-subtle">Posledních {DAYS} dní, po dnech (pražský čas). Porovnání: posledních 7 dní proti 7 dnům předtím.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Uživatelé celkem" value={totalUsers} sub={growth === null ? `za ${DAYS} dní +${totalUsers - users30ago}` : `za ${DAYS} dní +${totalUsers - users30ago} (${growth} %)`} />
        <Kpi label="Přihlásili se za 7 dní" value={wau.length} sub="nové přihlášení (kdo zůstává přihlášený, se nepočítá)" />
        <Kpi label="Přihlásili se za 30 dní" value={mau.length} sub="nové přihlášení" />
        <Kpi label={`Návštěvníci za ${DAYS} dní`} value={visitors30} sub="součet denních unikátů" />
        <Kpi
          label="Konverze na registraci"
          value={visitors30 ? `${((series[0].total / visitors30) * 100).toLocaleString('cs-CZ', { maximumFractionDigits: 1 })} %` : '–'}
          sub={`${series[0].total} registrací z ${visitors30} návštěv`}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {series.map((s) => {
          const tr = trend(s.last7, s.prev7)
          return (
            <section key={s.label} className="rounded-panel border border-line bg-card p-4">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-semibold">{s.label}</h2>
                <p className="text-sm tabular-nums">
                  <span className="font-bold">{s.last7}</span> <span className="text-subtle">za 7 dní</span>{' '}
                  <span className={`font-semibold ${tr.cls}`}>{tr.text}</span>
                </p>
              </div>
              <div className="mt-3">
                <Bars values={s.values} color={s.color} />
              </div>
              <div className="mt-1 flex justify-between text-[11px] text-subtle tabular-nums">
                <span>{fmtDay(days[0])}</span>
                <span>celkem {s.total.toLocaleString('cs-CZ')}</span>
                <span>{fmtDay(days[days.length - 1])}</span>
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
