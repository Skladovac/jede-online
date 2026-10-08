import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { parsePlace } from '@/lib/matches'
import { marketEntries, type MarketTab } from '@/lib/market'
import { COUNTRY_LABEL, REGIONS } from '@/lib/regions'
import { cardImage, productImage } from '@/lib/format'
import { getT } from '@/lib/i18n/server'

export async function generateMetadata() {
  const t = await getT()
  return {
    title: t('Tržiště'),
    description: t('Pokémon karty a produkty na prodej, na výměnu a poptávky „chci koupit“ od sběratelů z Česka a Slovenska.'),
  }
}
export const dynamic = 'force-dynamic'

const TABS: { id: MarketTab; label: string; hint: string; color: string }[] = [
  { id: 'prodej', label: '🏷️ Prodej', hint: 'Karty a produkty na prodej nebo zdarma za poštovné.', color: 'text-blue-700 dark:text-blue-400' },
  { id: 'koupim', label: '💰 Koupím', hint: 'Co sběratelé chtějí koupit a kolik za to dají. Máš to? Ozvi se jim.', color: 'text-emerald-700 dark:text-emerald-400' },
  { id: 'vymena', label: '🔁 Výměna', hint: 'Karty a produkty, které sběratelé nabízejí na výměnu.', color: 'text-orange-700 dark:text-orange-400' },
]

type Search = { tab?: string; kde?: string; sada?: string; strana?: string }

export default async function MarketPage({ searchParams }: { searchParams: Promise<Search> }) {
  const t = await getT()
  const sp = await searchParams
  const tab = TABS.find((x) => x.id === sp.tab) ?? TABS[0]
  const { key: kde, place } = parsePlace(sp.kde, null)
  const setId = sp.sada || null
  // Stránku omezíme (velké číslo by načetlo celou databázi).
  const page = Math.min(50, Math.max(1, Math.floor(Number(sp.strana)) || 1))
  const [{ entries, hasMore }, sets] = await Promise.all([
    marketEntries(tab.id, place, setId, page),
    prisma.cardSet.findMany({
      where: { game: 'pokemon' },
      select: { id: true, name: true },
      orderBy: { releaseDate: { sort: 'desc', nulls: 'last' } },
    }),
  ])
  const url = (over: Partial<Search>) => {
    const q = new URLSearchParams()
    const v = { tab: tab.id, kde, sada: setId ?? '', ...over }
    if (v.tab && v.tab !== 'prodej') q.set('tab', v.tab)
    if (v.kde && v.kde !== 'vse') q.set('kde', v.kde)
    if (v.sada) q.set('sada', v.sada)
    if (v.strana && v.strana !== '1') q.set('strana', v.strana)
    const s = q.toString()
    return `/trziste${s ? `?${s}` : ''}`
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-3xl font-black tracking-tight">{t('Tržiště')}</h1>
        <div className="flex gap-4 text-sm font-medium">
          <Link href="/sberatele" className="text-yellow-700 hover:underline dark:text-yellow-400">
            {t('Najdi sběratele →')}
          </Link>
          <Link href="/hodnoceni" className="text-yellow-700 hover:underline dark:text-yellow-400">
            {t('Nejlépe hodnocení →')}
          </Link>
        </div>
      </div>

      <nav className="mt-6 flex gap-2 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
        {TABS.map((x) => (
          <Link
            key={x.id}
            href={url({ tab: x.id, strana: '1' })}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2 font-semibold ${
              x.id === tab.id ? 'border-yellow-400 text-slate-900 dark:text-white' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            {t(x.label)}
          </Link>
        ))}
      </nav>
      <p className="mt-3 text-sm text-slate-500">{t(tab.hint)}</p>

      <form className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        {tab.id !== 'prodej' && <input type="hidden" name="tab" value={tab.id} />}
        <select
          name="kde"
          defaultValue={kde}
          aria-label={t('Kde')}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 dark:border-slate-700 dark:bg-slate-900"
        >
          <option value="vse">{t('Celé Česko a Slovensko')}</option>
          {(['CZ', 'SK'] as const).map((c) => (
            <optgroup key={c} label={t(COUNTRY_LABEL[c])}>
              <option value={c}>{c === 'CZ' ? t('Celé Česko') : t('Celé Slovensko')}</option>
              {REGIONS[c].map((r) => (
                <option key={r} value={`r:${r}`}>
                  {r}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <select
          name="sada"
          defaultValue={setId ?? ''}
          aria-label={t('Sada')}
          className="max-w-[16rem] rounded-lg border border-slate-300 bg-white px-3 py-1.5 dark:border-slate-700 dark:bg-slate-900"
        >
          <option value="">{t('Všechny sady')}</option>
          {sets.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button className="rounded-full bg-slate-900 px-4 py-1.5 font-semibold text-white dark:bg-yellow-400 dark:text-slate-900">{t('Filtrovat')}</button>
        {(kde !== 'vse' || setId) && (
          <Link href={url({ kde: 'vse', sada: '', strana: '1' })} className="text-slate-500 underline">
            {t('zrušit filtr')}
          </Link>
        )}
      </form>

      {entries.length ? (
        <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {entries.map((e) => {
            const img = e.image.kind === 'card' ? cardImage(e.image.url) : productImage(e.image.url)
            return (
              <li key={e.key}>
                <Link href={e.href} className="group block">
                  <div
                    className={`${e.image.kind === 'card' ? 'aspect-[63/88]' : 'aspect-square bg-white p-2 dark:bg-slate-900'} overflow-hidden rounded-lg bg-slate-200 shadow-sm transition group-hover:-translate-y-0.5 dark:bg-slate-800`}
                  >
                    {img && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt={e.name} loading="lazy" className={`h-full w-full ${e.image.kind === 'card' ? 'object-cover' : 'object-contain'}`} />
                    )}
                  </div>
                  <p className="mt-1.5 truncate text-sm font-medium">{e.name}</p>
                  <p className="truncate text-xs text-slate-500">{e.sub}</p>
                  <p className={`truncate text-sm font-semibold ${tab.color}`}>{e.label}</p>
                  <p className="truncate text-xs text-slate-500">
                    {e.user.nickname} · {e.user.city ?? e.user.region ?? t('neuvedeno')}
                  </p>
                </Link>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="mt-8 rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">
          {tab.id === 'koupim'
            ? t('Zatím tu nikdo nic nepoptává. U chybějící karty zaškrtni „💰 Chci koupit“ a budeš první.')
            : t('Zatím tu nic není. Karty navíc nabídneš v sadě v režimu „Navíc“.')}
        </p>
      )}

      {(page > 1 || hasMore) && (
        <div className="mt-8 flex justify-center gap-4 text-sm font-medium">
          {page > 1 && (
            <Link href={url({ strana: String(page - 1) })} className="underline">
              ← {t('Novější')}
            </Link>
          )}
          {hasMore && (
            <Link href={url({ strana: String(page + 1) })} className="underline">
              {t('Starší')} →
            </Link>
          )}
        </div>
      )}
    </main>
  )
}
