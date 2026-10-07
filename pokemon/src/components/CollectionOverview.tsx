import Link from 'next/link'
import type { Overview } from '@/lib/collection-view'
import { cardImage } from '@/lib/format'

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

export function CollectionOverview({ data, own }: { data: Overview; own: boolean }) {
  const { sets, offers, wanted, totals } = data
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
          <CardStrip
            cards={offers.map((o) => o.card)}
            extra={(_, i) => (
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                {offers[i].spareQty}× {offers[i].offerType === 'SELL' && offers[i].priceCzk
                  ? `${offers[i].priceCzk} Kč`
                  : OFFER[offers[i].offerType!]}
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
          <CardStrip cards={wanted} />
        ) : (
          <p className="text-sm text-slate-500">
            {own ? 'Zatím nic. V sadě přepni na „Chybí“ a označ karty, které sháníš.' : 'Zatím nic.'}
          </p>
        )}
      </section>

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
