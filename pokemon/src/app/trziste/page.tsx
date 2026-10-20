import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { parsePlace } from '@/lib/matches'
import { marketEntries, type MarketTab, type OfferFilter } from '@/lib/market'
import { COUNTRY_LABEL, REGIONS } from '@/lib/regions'
import { cardImage, productImage } from '@/lib/format'
import { getT } from '@/lib/i18n/server'
import { BadgeIcon } from '@/components/Badges'
import { MarketNav } from '@/components/MarketNav'
import { followingNicknames } from '@/lib/social'
import { EmptyState, btnInk, btnSecondary, linkAccent } from '@/components/design'
import { ArrowLeft, ArrowLeftRight, ArrowRight, Coins, Eye, Tag, type LucideIcon } from 'lucide-react'

export async function generateMetadata() {
  const t = await getT()
  return {
    title: t('Tržiště'),
    description: t('Pokémon karty a produkty na prodej, na výměnu a poptávky „chci koupit“ od sběratelů z Česka a Slovenska.'),
  }
}
export const dynamic = 'force-dynamic'

const TABS: { id: MarketTab; label: string; icon: LucideIcon; hint: string }[] = [
  { id: 'nabidky', label: 'Nabídky', icon: Tag, hint: 'Karty a produkty na prodej, na výměnu i zdarma za poštovné.' },
  { id: 'koupim', label: 'Koupím', icon: Coins, hint: 'Co sběratelé chtějí koupit a kolik za to dají. Máš to? Ozvi se jim.' },
]
// Rychlý filtr nabídek.
const FILTERS: { id: OfferFilter; label: string; icon?: LucideIcon }[] = [
  { id: 'vse', label: 'Vše' },
  { id: 'prodej', label: 'Prodej', icon: Tag },
  { id: 'vymena', label: 'Výměna', icon: ArrowLeftRight },
]
// Barva štítku podle druhu nabídky.
const KIND_COLOR = {
  sell: 'text-positive',
  gift: 'text-[#7a5600] dark:text-[#ffd95c]',
  trade: 'text-accent',
  buy: 'text-[#7a5600] dark:text-[#ffd95c]',
} as const

type Search = { tab?: string; druh?: string; kde?: string; sada?: string; strana?: string }

export default async function MarketPage({ searchParams }: { searchParams: Promise<Search> }) {
  const t = await getT()
  const sp = await searchParams
  // Staré odkazy ?tab=prodej / ?tab=vymena vedou na sloučené Nabídky s odpovídajícím filtrem.
  const tab = TABS.find((x) => x.id === sp.tab) ?? TABS[0]
  const druh: OfferFilter =
    sp.druh === 'prodej' || sp.druh === 'vymena' ? sp.druh : sp.tab === 'vymena' ? 'vymena' : sp.tab === 'prodej' ? 'prodej' : 'vse'
  const { key: kde, place } = parsePlace(sp.kde, null)
  const setId = sp.sada || null
  // Stránku omezíme (velké číslo by načetlo celou databázi).
  const page = Math.min(50, Math.max(1, Math.floor(Number(sp.strana)) || 1))
  const following = await followingNicknames()
  const [{ entries, hasMore }, sets] = await Promise.all([
    marketEntries(tab.id, place, setId, page, druh),
    prisma.cardSet.findMany({
      where: { game: 'pokemon' },
      select: { id: true, name: true },
      orderBy: { releaseDate: { sort: 'desc', nulls: 'last' } },
    }),
  ])
  const url = (over: Partial<Search>) => {
    const q = new URLSearchParams()
    const v = { tab: tab.id, druh, kde, sada: setId ?? '', ...over }
    if (v.tab && v.tab !== 'nabidky') q.set('tab', v.tab)
    if (v.tab !== 'koupim' && v.druh && v.druh !== 'vse') q.set('druh', v.druh)
    if (v.kde && v.kde !== 'vse') q.set('kde', v.kde)
    if (v.sada) q.set('sada', v.sada)
    if (v.strana && v.strana !== '1') q.set('strana', v.strana)
    const s = q.toString()
    return `/trziste${s ? `?${s}` : ''}`
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-4xl font-extrabold text-fg sm:text-[44px]">{t('Tržiště')}</h1>
        <div className="flex gap-4 text-sm">
          <Link href="/sberatele" className={`${linkAccent} inline-flex items-center gap-1`}>
            {t('Najdi sběratele')}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link href="/hodnoceni" className={`${linkAccent} inline-flex items-center gap-1`}>
            {t('Nejlépe hodnocení')}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>

      <MarketNav active={tab.id} hrefs={Object.fromEntries(TABS.map((x) => [x.id, url({ tab: x.id, strana: '1' })]))} />
      <p className="mt-3 text-sm text-muted">{t(tab.hint)}</p>
      {tab.id === 'nabidky' && (
        <div className="mt-4 inline-flex gap-1 rounded-xl bg-surface p-1 ring-1 ring-inset ring-line" role="group" aria-label={t('Druh nabídky')}>
          {FILTERS.map((f) => (
            <Link
              key={f.id}
              href={url({ druh: f.id, strana: '1' })}
              aria-current={druh === f.id ? 'true' : undefined}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-[9px] px-3.5 text-sm font-semibold transition ${
                druh === f.id ? 'bg-card text-fg shadow-soft ring-1 ring-inset ring-line' : 'text-muted hover:text-fg'
              }`}
            >
              {f.icon && <f.icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />}
              {t(f.label)}
            </Link>
          ))}
        </div>
      )}

      <form className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        {tab.id !== 'nabidky' && <input type="hidden" name="tab" value={tab.id} />}
        {tab.id === 'nabidky' && druh !== 'vse' && <input type="hidden" name="druh" value={druh} />}
        <select
          name="kde"
          defaultValue={kde}
          aria-label={t('Kde')}
          className="min-h-11 rounded-xl border border-line-strong bg-card px-3 py-2 text-fg"
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
          className="min-h-11 max-w-[16rem] rounded-xl border border-line-strong bg-card px-3 py-2 text-fg"
        >
          <option value="">{t('Všechny sady')}</option>
          {sets.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button className={btnInk}>{t('Filtrovat')}</button>
        {(kde !== 'vse' || setId) && (
          <Link href={url({ kde: 'vse', sada: '', strana: '1' })} className="text-muted underline underline-offset-4 hover:text-fg">
            {t('zrušit filtr')}
          </Link>
        )}
      </form>

      {entries.length ? (
        <ul className="mt-8 grid grid-cols-3 gap-x-2.5 gap-y-6 sm:gap-x-5 sm:gap-y-8 md:grid-cols-4 lg:grid-cols-6">
          {entries.map((e) => {
            const img = e.image.kind === 'card' ? cardImage(e.image.url) : productImage(e.image.url)
            return (
              <li key={e.key}>
                <Link href={e.href} className="card-tile group block">
                  <div className={e.image.kind === 'card' ? 'card-frame aspect-[63/88]' : 'card-frame aspect-square !bg-card p-2'}>
                    {img && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt={e.name} loading="lazy" className={`h-full w-full ${e.image.kind === 'card' ? 'object-cover' : 'object-contain'}`} />
                    )}
                  </div>
                  <p className="mt-2 truncate text-[12.5px] font-semibold text-fg sm:mt-3 sm:text-[14.5px]">{e.name}</p>
                  <p className="truncate text-xs text-muted">{e.sub}</p>
                  <p className={`mt-1 truncate text-sm font-semibold tabular-nums ${KIND_COLOR[e.kind]}`}>{e.label}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-subtle">
                    <span className="truncate">
                      {e.user.nickname} · {e.user.city ?? e.user.region ?? t('neuvedeno')}
                    </span>
                    <BadgeIcon nickname={e.user.nickname} />
                  </p>
                  {following.has(e.user.nickname) && (
                    <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-accent">
                      <Eye className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                      {t('Sleduješ')}
                    </p>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      ) : (
        <EmptyState className="mt-8">
          {tab.id === 'koupim'
            ? t('Zatím tu nikdo nic nepoptává. U chybějící karty zaškrtni „Chci koupit“ a budeš první.')
            : t('Zatím tu nic není. Karty navíc nabídneš v sadě v režimu „Navíc“.')}
        </EmptyState>
      )}

      {(page > 1 || hasMore) && (
        <div className="mt-10 flex justify-center gap-3 text-sm">
          {page > 1 && (
            <Link href={url({ strana: String(page - 1) })} className={btnSecondary}>
              <ArrowLeft aria-hidden />
              {t('Novější')}
            </Link>
          )}
          {hasMore && (
            <Link href={url({ strana: String(page + 1) })} className={btnSecondary}>
              {t('Starší')}
              <ArrowRight aria-hidden />
            </Link>
          )}
        </div>
      )}
    </main>
  )
}
