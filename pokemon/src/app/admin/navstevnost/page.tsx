import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin'

// Sekce webu podle první části adresy (/karta/… → Detail karty).
const SECTION: Record<string, string> = {
  '': 'Hlavní stránka',
  karta: 'Detail karty',
  sady: 'Sady',
  produkt: 'Detail produktu',
  produkty: 'Produkty',
  trziste: 'Tržiště',
  sberatele: 'Sběratelé',
  u: 'Profily',
  sbirka: 'Moje sbírka',
  hledat: 'Hledání',
  hodnoceni: 'Žebříček hodnocení',
  poptavky: 'Výměny',
  kosik: 'Košík',
  registrace: 'Registrace',
  prihlaseni: 'Přihlášení',
  ucet: 'Můj účet',
}

export default async function AdminTraffic() {
  // Kontrola i na stránce, ne jen v layoutu.
  await requireAdmin()
  const since30 = new Date(Date.now() - 30 * 86_400_000)
  const since7 = new Date(Date.now() - 7 * 86_400_000)
  const [daily, uniques, top] = await Promise.all([
    prisma.pageStat.groupBy({ by: ['day'], where: { day: { gte: since30 } }, _sum: { views: true }, orderBy: { day: 'desc' } }),
    prisma.visitorDay.groupBy({ by: ['day'], where: { day: { gte: since30 } }, _count: true }),
    prisma.pageStat.groupBy({ by: ['path'], where: { day: { gte: since7 } }, _sum: { views: true } }),
  ])
  const uniq = new Map(uniques.map((u) => [u.day.toISOString(), u._count]))
  const topPaths = [...top].sort((a, b) => (b._sum.views ?? 0) - (a._sum.views ?? 0)).slice(0, 25)
  const sections = new Map<string, number>()
  for (const t of top) {
    const first = t.path.split('/')[1] ?? ''
    // Profily mají adresu /@přezdívka.
    const key = first.startsWith('@') ? 'Profily' : SECTION[first] ?? 'Ostatní'
    sections.set(key, (sections.get(key) ?? 0) + (t._sum.views ?? 0))
  }
  const sectionRows = [...sections.entries()].sort((a, b) => b[1] - a[1])
  const total7 = topPaths.length ? [...top].reduce((s, t) => s + (t._sum.views ?? 0), 0) : 0
  const max = Math.max(1, ...daily.map((d) => d._sum.views ?? 0))
  const fmt = (d: Date) => d.toLocaleDateString('cs-CZ', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'numeric' })

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Návštěvnost</h1>
        <p className="mt-1 text-sm text-subtle">
          Vlastní počítadlo bez cookies. Unikátní návštěvník = jeden prohlížeč za den. Roboti a administrace se nepočítají.
        </p>
      </div>

      <section className="rounded-panel border border-line bg-card p-5">
        <h2 className="mb-3 font-bold">Posledních 30 dní</h2>
        {daily.length ? (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-subtle">
              <tr>
                <th className="py-1">Den</th>
                <th className="py-1 text-right">Návštěvníci</th>
                <th className="py-1 text-right">Zobrazení</th>
                <th className="w-1/2 py-1" />
              </tr>
            </thead>
            <tbody>
              {daily.map((d) => {
                const v = d._sum.views ?? 0
                return (
                  <tr key={d.day.toISOString()} className="border-t border-line">
                    <td className="py-1.5">{fmt(d.day)}</td>
                    <td className="py-1.5 text-right font-semibold">{uniq.get(d.day.toISOString()) ?? 0}</td>
                    <td className="py-1.5 text-right">{v}</td>
                    <td className="py-1.5 pl-3">
                      <div className="h-2 rounded-full bg-accent-strong" style={{ width: `${(v / max) * 100}%` }} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-subtle">Zatím žádná data. Počítá se od nasazení.</p>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-panel border border-line bg-card p-5">
          <h2 className="mb-3 font-bold">Sekce webu (7 dní, {total7} zobrazení)</h2>
          <ul className="space-y-1 text-sm">
            {sectionRows.map(([k, v]) => (
              <li key={k} className="flex justify-between border-t border-line py-1">
                <span>{k}</span>
                <span className="font-semibold">{v}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-panel border border-line bg-card p-5">
          <h2 className="mb-3 font-bold">Nejčtenější stránky (7 dní)</h2>
          <ul className="space-y-1 text-sm">
            {topPaths.map((t) => (
              <li key={t.path} className="flex justify-between gap-3 border-t border-line py-1">
                <a href={t.path} className="truncate underline" target="_blank" rel="noreferrer">
                  {t.path}
                </a>
                <span className="shrink-0 font-semibold">{t._sum.views}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
