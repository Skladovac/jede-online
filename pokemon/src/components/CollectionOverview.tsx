import Link from 'next/link'
import type { Overview } from '@/lib/collection-view'
import { cardImage } from '@/lib/format'
import { splitBase } from '@/lib/card-number'
import { CardImg } from '@/components/CardImg'
import { ProductTile } from '@/components/ProductTile'
import { ProgressBars } from '@/components/ProgressBars'
import { getT } from '@/lib/i18n/server'
import type { TFunc } from '@/lib/i18n/config'

const OFFER = { TRADE: 'vyměním', SELL: 'prodám', GIFT: 'daruji za poštovné' } as const

type MiniCard = { id: string; name: string; localId: string; imageUrl: string | null; set: { name: string } }

function CardStrip({ cards, extra }: { cards: MiniCard[]; extra?: (c: MiniCard, i: number) => React.ReactNode }) {
  return (
    <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
      {cards.map((c, i) => {
        const img = cardImage(c.imageUrl)
        return (
          <li key={`${c.id}-${i}`}>
            <Link href={`/karta/${encodeURIComponent(c.id)}`} className="group block">
              <div className="aspect-[63/88] overflow-hidden rounded-lg bg-slate-200 shadow-sm dark:bg-slate-800">
                <CardImg src={img} alt={c.name} />
              </div>
              <p className="mt-1 truncate text-xs font-medium">{c.name}</p>
              <p className="truncate text-xs text-slate-500">
                {c.set.name} · {c.localId}
              </p>
              {extra?.(c, i)}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

/** Štítek poptávky „chci koupit“. */
export async function BuyBadge({ price }: { price: number | null }) {
  const t = await getT()
  return (
    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
      💰 {price ? t('koupím do {price} Kč', { price: price.toLocaleString('cs-CZ') }) : t('koupím')}
    </p>
  )
}

type SetInfo = { id: string; name: string; releaseDate: Date | null; officialCount: number }

/** Karty rozdělené po sadách (nejnovější sada nahoře), každá sada jde sbalit. */
function BySet<T>({
  t,
  items,
  card,
  extra,
}: {
  t: TFunc
  items: T[]
  card: (t: T) => MiniCard & { set: SetInfo }
  extra?: (t: T) => React.ReactNode
}) {
  const groups = new Map<string, { set: SetInfo; items: T[] }>()
  for (const t of items) {
    const set = card(t).set
    const g = groups.get(set.id) ?? { set, items: [] }
    g.items.push(t)
    groups.set(set.id, g)
  }
  const sorted = [...groups.values()].sort((a, b) => (b.set.releaseDate?.getTime() ?? 0) - (a.set.releaseDate?.getTime() ?? 0))
  return (
    <div className="space-y-3">
      {sorted.map(({ set, items: list }) => (
        <details key={set.id} open className="group rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold">
            <span className="text-slate-400 transition group-open:rotate-90">▸</span>
            <span className="min-w-0 flex-1 truncate">{set.name}</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">{list.length}</span>
            <Link href={`/sady/${encodeURIComponent(set.id)}`} className="text-xs font-normal text-slate-500 underline">
              {t('sada')}
            </Link>
          </summary>
          <div className="mt-3 space-y-4">
            {(() => {
              // Base set (1–oficiální počet) a zvlášť secret rare / karty mimo číslování.
              const { base, extra: rest } = splitBase(list, (t) => card(t).localId, set.officialCount)
              return (
                <>
                  {base.length > 0 && (
                    <div>
                      {set.officialCount > 0 && (
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Base set (1–{set.officialCount}) · {base.length}
                        </p>
                      )}
                      <CardStrip cards={base.map(card)} extra={extra && ((_, i) => extra(base[i]))} />
                    </div>
                  )}
                  {rest.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-purple-600 dark:text-purple-400">
                        {t('Secret rare a mimo číslování')} · {rest.length}
                      </p>
                      <CardStrip cards={rest.map(card)} extra={extra && ((_, i) => extra(rest[i]))} />
                    </div>
                  )}
                </>
              )
            })()}
          </div>
        </details>
      ))}
    </div>
  )
}

/**
 * Přehled sbírky. `view` (veřejný profil): ukázat jen „Nabízím“ nebo jen „Hledám“ — přepínač je nad tím,
 * statistiky a sady jdou až pod vybraný seznam.
 */
export async function CollectionOverview({ data, own, view }: { data: Overview; own: boolean; view?: 'nabizim' | 'hledam' }) {
  const t = await getT()
  const { sets, offers, wanted, totals } = data
  const showOffers = view !== 'hledam'
  const showWanted = view !== 'nabizim'
  const productItems = view === 'nabizim' ? data.productItems.filter((i) => i.spareQty > 0 && i.offerType) : view === 'hledam' ? [] : data.productItems
  const productWants = view === 'nabizim' ? [] : data.productWants
  const OFFER_SHORT = { TRADE: 'vyměním', SELL: 'prodám', GIFT: 'daruji' } as const
  const stats = (
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [t('Různých karet'), totals.cards],
          [t('Kusů celkem'), totals.pieces],
          [t('Navíc k výměně'), totals.spare],
          [t('Chybí'), totals.wanted],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <dt className="text-xs text-slate-500">{k}</dt>
            <dd className="text-2xl font-black">{v}</dd>
          </div>
        ))}
      </dl>
  )
  return (
    <div className="space-y-10">
      {!view && stats}


      {showOffers && (
      <section>
        <h2 className="mb-3 text-xl font-bold">{t('Nabízí')} ({offers.length})</h2>
        {offers.length ? (
          <BySet
            t={t}
            items={offers}
            card={(o) => o.card}
            extra={(o) => (
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                {o.spareQty}× {o.offerType === 'SELL' && o.priceCzk ? `${o.priceCzk} Kč` : t(OFFER[o.offerType!])}
              </p>
            )}
          />
        ) : (
          <p className="text-sm text-slate-500">
            {own ? t('Zatím nic. V sadě přepni na „Navíc“ a klepni na karty, které máš víckrát.') : t('Zatím nic.')}
          </p>
        )}
      </section>
      )}

      {showWanted && (
      <section>
        <h2 className="mb-3 text-xl font-bold">{t('Chybí')} ({wanted.length})</h2>
        {wanted.length ? (
          <BySet
            t={t}
            items={wanted}
            card={(c) => c}
            extra={(c) => c.buy && <BuyBadge price={c.maxPriceCzk} />}
          />
        ) : (
          <p className="text-sm text-slate-500">
            {own ? t('Zatím nic. V sadě přepni na „Chybí“ a označ karty, které sháníš.') : t('Zatím nic.')}
          </p>
        )}
      </section>
      )}

      {(productItems.length > 0 || productWants.length > 0 || (own && !view)) && (
        <section>
          <h2 className="mb-3 text-xl font-bold">{t('Zapečetěné produkty')}</h2>
          {productItems.length ? (
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
              {productItems.map((i) => (
                <li key={i.id}>
                  <ProductTile
                    p={i.product}
                    extra={
                      <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                        {i.quantity}× {i.language.toUpperCase()}
                        {i.spareQty > 0 && i.offerType &&
                          ` · ${i.spareQty}× ${i.offerType === 'SELL' && i.priceCzk ? `${i.priceCzk} Kč` : t(OFFER_SHORT[i.offerType])}`}
                      </p>
                    }
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">
              {own ? (
                <>
                  {t('Zatím žádné.')}{' '}
                  <Link href="/produkty" className="underline">
                    {t('Najdi produkt')}
                  </Link>{' '}
                  {t('(ETB, booster box, tin…) a přidej si ho nebo nabídni.')}
                </>
              ) : (
                t('Zatím žádné.')
              )}
            </p>
          )}
          {productWants.length > 0 && (
            <>
              <h3 className="mb-3 mt-6 font-semibold">{t('Shání')} ({productWants.length})</h3>
              <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
                {productWants.map((p) => (
                  <li key={p.id}>
                    <ProductTile p={p} extra={p.buy ? <BuyBadge price={p.maxPriceCzk} /> : undefined} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {view && stats}

      <section>
        <h2 className="mb-3 text-xl font-bold">{t('Sady')}</h2>
        {sets.length ? (
          <ul className="space-y-2">
            {sets.map(({ set, owned, progress }) => (
              <li key={set.id}>
                <Link
                  href={`/sady/${encodeURIComponent(set.id)}`}
                  className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-yellow-400 dark:border-slate-800 dark:bg-slate-900"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{set.name}</span>
                    <ProgressBars p={progress} compact />
                  </span>
                  <span className="hidden h-2 w-32 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800 sm:block" title="Base">
                    <span
                      className="block h-full rounded-full bg-green-500"
                      style={{ width: `${progress.base ? Math.min(100, (progress.base.owned / Math.max(progress.base.total, 1)) * 100) : Math.min(100, (owned / Math.max(progress.complete.total, 1)) * 100)}%` }}
                    />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">
            {own ? (
              <>
                {t('Sbírka je prázdná.')}{' '}
                <Link href="/sady" className="underline">
                  {t('Vyber sadu')}
                </Link>{' '}
                {t('a odklikej karty, které máš.')}
              </>
            ) : (
              t('Sbírka je zatím prázdná.')
            )}
          </p>
        )}
      </section>
    </div>
  )
}
