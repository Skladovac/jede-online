import Link from 'next/link'
import type { Overview } from '@/lib/collection-view'
import { cardImage } from '@/lib/format'
import { ProductTile } from '@/components/ProductTile'

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
                {img && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img} alt={c.name} loading="lazy" className="h-full w-full object-cover" />
                )}
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

type SetInfo = { id: string; name: string; releaseDate: Date | null }

/** Karty rozdělené po sadách (nejnovější sada nahoře), každá sada jde sbalit. */
function BySet<T>({
  items,
  card,
  extra,
}: {
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
              sada
            </Link>
          </summary>
          <div className="mt-3">
            <CardStrip cards={list.map(card)} extra={extra && ((_, i) => extra(list[i]))} />
          </div>
        </details>
      ))}
    </div>
  )
}

export function CollectionOverview({ data, own }: { data: Overview; own: boolean }) {
  const { sets, offers, wanted, totals, productItems, productWants } = data
  const OFFER_SHORT = { TRADE: 'vyměním', SELL: 'prodám', GIFT: 'daruji' } as const
  return (
    <div className="space-y-10">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Různých karet', totals.cards],
          ['Kusů celkem', totals.pieces],
          ['Navíc k výměně', totals.spare],
          ['Chybí', totals.wanted],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <dt className="text-xs text-slate-500">{k}</dt>
            <dd className="text-2xl font-black">{v}</dd>
          </div>
        ))}
      </dl>

      <section>
        <h2 className="mb-3 text-xl font-bold">Nabízí ({offers.length})</h2>
        {offers.length ? (
          <BySet
            items={offers}
            card={(o) => o.card}
            extra={(o) => (
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                {o.spareQty}× {o.offerType === 'SELL' && o.priceCzk ? `${o.priceCzk} Kč` : OFFER[o.offerType!]}
              </p>
            )}
          />
        ) : (
          <p className="text-sm text-slate-500">
            {own ? 'Zatím nic. V sadě přepni na „Navíc“ a klepni na karty, které máš víckrát.' : 'Zatím nic.'}
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xl font-bold">Chybí ({wanted.length})</h2>
        {wanted.length ? (
          <BySet items={wanted} card={(c) => c} />
        ) : (
          <p className="text-sm text-slate-500">
            {own ? 'Zatím nic. V sadě přepni na „Chybí“ a označ karty, které sháníš.' : 'Zatím nic.'}
          </p>
        )}
      </section>

      {(productItems.length > 0 || productWants.length > 0 || own) && (
        <section>
          <h2 className="mb-3 text-xl font-bold">Zapečetěné produkty</h2>
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
                          ` · ${i.spareQty}× ${i.offerType === 'SELL' && i.priceCzk ? `${i.priceCzk} Kč` : OFFER_SHORT[i.offerType]}`}
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
                  Zatím žádné.{' '}
                  <Link href="/produkty" className="underline">
                    Najdi produkt
                  </Link>{' '}
                  (ETB, booster box, tin…) a přidej si ho nebo nabídni.
                </>
              ) : (
                'Zatím žádné.'
              )}
            </p>
          )}
          {productWants.length > 0 && (
            <>
              <h3 className="mb-3 mt-6 font-semibold">Shání ({productWants.length})</h3>
              <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
                {productWants.map((p) => (
                  <li key={p.id}>
                    <ProductTile p={p} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      <section>
        <h2 className="mb-3 text-xl font-bold">Sady</h2>
        {sets.length ? (
          <ul className="space-y-2">
            {sets.map(({ set, owned }) => (
              <li key={set.id}>
                <Link
                  href={`/sady/${encodeURIComponent(set.id)}`}
                  className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-yellow-400 dark:border-slate-800 dark:bg-slate-900"
                >
                  <span className="min-w-0 flex-1 truncate font-medium">{set.name}</span>
                  <span className="hidden h-2 w-40 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800 sm:block">
                    <span
                      className="block h-full rounded-full bg-green-500"
                      style={{ width: `${Math.min(100, (owned / Math.max(set.officialCount, 1)) * 100)}%` }}
                    />
                  </span>
                  <span className="shrink-0 text-sm text-slate-500">
                    {owned}/{set.officialCount}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">
            {own ? (
              <>
                Sbírka je prázdná.{' '}
                <Link href="/sady" className="underline">
                  Vyber sadu
                </Link>{' '}
                a odklikej karty, které máš.
              </>
            ) : (
              'Sbírka je zatím prázdná.'
            )}
          </p>
        )}
      </section>
    </div>
  )
}
