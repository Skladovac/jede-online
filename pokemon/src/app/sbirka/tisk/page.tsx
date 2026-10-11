import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { byLocalId, cardImage, formatCzk, rarityLabel, setDisplayName } from '@/lib/format'
import { ensureEurCzk } from '@/lib/fx'
import { PrintButton } from '@/components/PrintButton'
import { btnInk, panel } from '@/components/design'
import { getT, getLocale } from '@/lib/i18n/server'
import { LOCALE_INFO } from '@/lib/i18n/config'

export async function generateMetadata() {
  const t = await getT()
  return { title: t('Seznam chybějících karet k tisku'), robots: { index: false } }
}
export const dynamic = 'force-dynamic'

type Search = { rezim?: string; vzhled?: string; sady?: string | string[] }
const MAX_CARDS = 3000

/**
 * Seznam chybějících karet k tisku (burza, obchod): „Moje chybějící“ nebo „Vše, co v sadě nemám“,
 * výběr sad, vzhled tabulka / obrázky. Tiskne se přes prohlížeč (A4, bez menu), jde uložit i jako PDF.
 */
export default async function PrintMissingPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await getCurrentUser()
  if (!user) redirect('/prihlaseni?next=/sbirka/tisk')
  await ensureEurCzk()
  const [t, locale, sp] = await Promise.all([getT(), getLocale(), searchParams])
  const mode = sp.rezim === 'nemam' ? 'nemam' : 'chybi'
  const look = sp.vzhled === 'obrazky' ? 'obrazky' : 'tabulka'

  // Sady k výběru: kde mám karty nebo něco hledám.
  const [ownedSets, wantSets] = await Promise.all([
    prisma.card.findMany({ where: { items: { some: { userId: user.id, quantity: { gt: 0 } } } }, select: { setId: true }, distinct: ['setId'] }),
    prisma.card.findMany({ where: { wants: { some: { userId: user.id } } }, select: { setId: true }, distinct: ['setId'] }),
  ])
  const candidateIds = [...new Set([...wantSets, ...ownedSets].map((c) => c.setId))]
  const sets = await prisma.cardSet.findMany({
    where: { id: { in: candidateIds } },
    select: { id: true, name: true, code: true, officialCount: true, releaseDate: true },
    orderBy: { releaseDate: { sort: 'desc', nulls: 'last' } },
  })
  const picked = (Array.isArray(sp.sady) ? sp.sady : sp.sady ? [sp.sady] : []).filter((id) => sets.some((s) => s.id === id))
  // Bez výběru: u „chybějících“ všechny sady s označenými kartami, u „vše, co nemám“ nic (uživatel musí vybrat).
  const chosen = picked.length ? picked : mode === 'chybi' ? [...new Set(wantSets.map((c) => c.setId))] : []

  const cards = chosen.length
    ? await prisma.card.findMany({
        where:
          mode === 'chybi'
            ? { setId: { in: chosen }, wants: { some: { userId: user.id } }, items: { none: { userId: user.id, quantity: { gt: 0 } } } }
            : { setId: { in: chosen }, items: { none: { userId: user.id, quantity: { gt: 0 } } } },
        select: { id: true, localId: true, name: true, rarity: true, priceEur: true, imageUrl: true, setId: true },
        take: MAX_CARDS,
      })
    : []
  const bySet = sets
    .filter((s) => chosen.includes(s.id))
    .map((s) => ({ set: s, cards: cards.filter((c) => c.setId === s.id).sort(byLocalId) }))
    .filter((g) => g.cards.length)
  const total = bySet.reduce((n, g) => n + g.cards.length, 0)
  const date = new Date().toLocaleDateString(LOCALE_INFO[locale].intl, { day: 'numeric', month: 'numeric', year: 'numeric' })

  const radio = (name: string, value: string, current: string, label: string) => (
    <label className="flex cursor-pointer items-center gap-2">
      <input type="radio" name={name} value={value} defaultChecked={current === value} className="h-4 w-4 accent-[var(--pokemon-blue)]" />
      {label}
    </label>
  )

  return (
    <main className="mx-auto max-w-5xl px-4 pb-10 pt-6 print:max-w-none print:p-0">
      <div className="no-print">
        <nav aria-label={t('Drobečková navigace')} className="flex items-center gap-1.5 text-sm text-subtle">
          <Link href="/sbirka" className="text-muted hover:text-fg">
            {t('Moje sbírka')}
          </Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          <span className="text-fg">{t('Seznam k tisku')}</span>
        </nav>
        <h1 className="mt-4 text-4xl font-extrabold text-fg sm:text-[44px]">{t('Seznam chybějících karet k tisku')}</h1>
        <p className="mt-2 text-muted">{t('Vytiskni si ho na burzu nebo do obchodu, případně ho v okně tisku ulož jako PDF.')}</p>

        <form className={`${panel} mt-6 space-y-5 p-5 sm:p-6`}>
          <fieldset>
            <legend className="mb-2 text-[13.5px] font-semibold text-fg">{t('Které karty')}</legend>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-fg">
              {radio('rezim', 'chybi', mode, t('Moje chybějící (označené „Chybí“)'))}
              {radio('rezim', 'nemam', mode, t('Vše, co ve vybraných sadách nemám'))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-[13.5px] font-semibold text-fg">{t('Vzhled')}</legend>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-fg">
              {radio('vzhled', 'tabulka', look, t('Tabulka (víc karet na stránku)'))}
              {radio('vzhled', 'obrazky', look, t('Obrázky (snadnější hledání)'))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-[13.5px] font-semibold text-fg">{t('Sady')}</legend>
            {sets.length ? (
              <div className="grid max-h-56 gap-1.5 overflow-y-auto pr-1 text-sm text-fg sm:grid-cols-2">
                {sets.map((s) => (
                  <label key={s.id} className="flex cursor-pointer items-center gap-2">
                    <input type="checkbox" name="sady" value={s.id} defaultChecked={chosen.includes(s.id)} className="h-4 w-4 accent-[var(--pokemon-blue)]" />
                    <span className="truncate">{setDisplayName(s)}</span>
                    {s.code && <span className="font-mono text-[11px] text-subtle">{s.code}</span>}
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">{t('Zatím nemáš žádné karty ani chybějící. Začni ve Sbírce nebo v sadě.')}</p>
            )}
          </fieldset>
          <div className="flex flex-wrap items-center gap-3">
            <button className={btnInk}>{t('Zobrazit seznam')}</button>
            {total > 0 && <PrintButton label={t('Vytisknout')} />}
            {mode === 'nemam' && !chosen.length && <p className="text-sm text-muted">{t('Vyber aspoň jednu sadu.')}</p>}
          </div>
        </form>
      </div>

      {/* Tisková část */}
      <section className="mt-8 print:mt-0">
        <div className="flex items-baseline justify-between border-b-2 border-fg pb-2 print:border-black">
          <h2 className="text-xl font-bold text-fg print:text-black">
            {mode === 'chybi' ? t('Hledám') : t('Nemám')} · {user.nickname}
          </h2>
          <p className="font-mono text-xs text-muted print:text-black">
            {date} · {t('{n} karet', { n: total })} · pokemon.jede.online
          </p>
        </div>
        {total >= MAX_CARDS && <p className="no-print mt-2 text-sm text-warning">{t('Seznam je zkrácený na {n} karet — vyber méně sad.', { n: MAX_CARDS })}</p>}
        {!total && <p className="mt-6 text-muted">{t('Nic k vytištění. Zkus vybrat jiné sady nebo přepnout na „Vše, co nemám“.')}</p>}

        {bySet.map(({ set, cards: list }) => (
          <div key={set.id} className="mt-6 print:mt-4">
            <h3 className="flex items-baseline gap-2 text-base font-bold text-fg [break-after:avoid] print:text-black">
              {setDisplayName(set)}
              <span className="font-mono text-xs font-normal text-subtle print:text-black">
                {set.code} · {list.length}
              </span>
            </h3>
            {look === 'tabulka' ? (
              <table className="mt-2 w-full border-collapse text-[13px] print:text-[10.5pt]">
                <thead>
                  <tr className="border-b border-line-strong text-left text-[11px] uppercase tracking-wide text-subtle print:border-black print:text-black">
                    <th className="w-8 py-1 font-semibold" aria-label={t('Mám')} />
                    <th className="w-20 py-1 font-semibold">{t('Číslo')}</th>
                    <th className="py-1 font-semibold">{t('Název')}</th>
                    <th className="hidden py-1 font-semibold sm:table-cell print:table-cell">{t('Vzácnost')}</th>
                    <th className="py-1 text-right font-semibold">{t('Cena')}</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((c) => (
                    <tr key={c.id} className="border-b border-line print:border-gray-300">
                      <td className="py-1">
                        <span className="inline-block h-3.5 w-3.5 rounded-[3px] border border-line-strong print:border-black" />
                      </td>
                      <td className="py-1 font-mono text-fg print:text-black">
                        {c.localId}
                        {set.officialCount ? <span className="text-subtle print:text-gray-600">/{set.officialCount}</span> : null}
                      </td>
                      <td className="py-1 text-fg print:text-black">{c.name}</td>
                      <td className="hidden py-1 text-muted sm:table-cell print:table-cell print:text-gray-700">{c.rarity && c.rarity !== 'None' ? t(rarityLabel(c.rarity)!) : ''}</td>
                      <td className="py-1 text-right tabular-nums text-muted print:text-black">{formatCzk(c.priceEur) ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <ul className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 print:grid-cols-8 print:gap-1.5">
                {list.map((c) => {
                  const img = cardImage(c.imageUrl)
                  return (
                    <li key={c.id} className="break-inside-avoid">
                      <div className="aspect-[63/88] overflow-hidden rounded bg-surface ring-1 ring-line print:ring-gray-300">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {img && <img src={img} alt="" loading="eager" className="h-full w-full object-cover" />}
                      </div>
                      <p className="mt-0.5 truncate font-mono text-[10px] text-fg print:text-black">{c.localId}</p>
                      <p className="truncate text-[10px] leading-tight text-muted print:text-black">{c.name}</p>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        ))}
      </section>
    </main>
  )
}
