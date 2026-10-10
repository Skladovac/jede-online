import Link from 'next/link'
import type { pairMatches } from '@/lib/matches'
import { cardImage } from '@/lib/format'
import { AddToCart } from '@/components/AddToCart'
import { ProductTile } from '@/components/ProductTile'
import { getT } from '@/lib/i18n/server'
import { CardImg } from '@/components/CardImg'

type Data = Awaited<ReturnType<typeof pairMatches>>
type MiniCard = { id: string; name: string; localId: string; imageUrl: string | null; set: { name: string } }

const OFFER = { TRADE: 'vyměním', SELL: 'prodám', GIFT: 'daruji' } as const

function Thumb({ c, children }: { c: MiniCard; children?: React.ReactNode }) {
  const img = cardImage(c.imageUrl)
  return (
    <li>
      <Link href={`/karta/${encodeURIComponent(c.id)}`} className="block">
        <div className="aspect-[63/88] overflow-hidden rounded-lg bg-surface shadow-sm">
          {img && (
            <CardImg src={img} alt={c.name} />
          )}
        </div>
        <p className="mt-1 truncate text-xs font-medium">{c.name}</p>
        <p className="truncate text-xs text-subtle">
          {c.set.name} · {c.localId}
        </p>
      </Link>
      {children}
    </li>
  )
}

const grid = 'grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6'

/** Na profilu cizího sběratele: co z toho, co mi chybí, má on a co on shání ode mě. */
export async function MatchSection({ data, nickname }: { data: Data; nickname: string }) {
  const t = await getT()
  const { offeredCards, ownedCards, offeredProducts, theyWantCards, theyWantProducts } = data
  if (!offeredCards.length && !ownedCards.length && !offeredProducts.length && !theyWantCards.length && !theyWantProducts.length)
    return null
  const trade = (offeredCards.length || offeredProducts.length) > 0 && (theyWantCards.length || theyWantProducts.length) > 0

  return (
    <section id="shoda" className="mt-10 scroll-mt-24 rounded-panel border-2 border-accent p-4 sm:p-6">
      <h2 className="text-xl font-bold">
        {t('Shoda s tebou')}
        {trade && (
          <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 align-middle text-xs font-semibold text-green-800 dark:bg-green-400/10 dark:text-green-300">
            🔁 {t('Výměna možná')}
          </span>
        )}
      </h2>

      {(offeredCards.length > 0 || offeredProducts.length > 0) && (
        <>
          <h3 className="mb-3 mt-5 font-semibold">{t('Nabízí, co ti chybí')}</h3>
          <ul className={grid}>
            {offeredCards.map((i) => (
              <Thumb key={i.id} c={i.card}>
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                  {i.spareQty}× {i.offerType === 'SELL' && i.priceCzk ? `${i.priceCzk} Kč` : t(OFFER[i.offerType!])}
                </p>
                <div className="mt-1">
                  <AddToCart collectionItemId={i.id} />
                </div>
              </Thumb>
            ))}
            {offeredProducts.map((i) => (
              <li key={i.id}>
                <ProductTile p={i.product} />
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                  {i.spareQty}× {i.offerType === 'SELL' && i.priceCzk ? `${i.priceCzk} Kč` : t(OFFER[i.offerType!])}
                </p>
                <div className="mt-1">
                  <AddToCart productItemId={i.id} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {ownedCards.length > 0 && (
        <>
          <h3 className="mb-1 mt-6 font-semibold">{t('Má ve sbírce, ale nenabízí')}</h3>
          <p className="mb-3 text-xs text-subtle">
            {t('Nejsou na výměnu, ale můžeš se {name} zeptat, jestli by je neuvolnil(a).', { name: nickname })}
          </p>
          <ul className={grid}>
            {ownedCards.map((c) => (
              <Thumb key={c.id} c={c} />
            ))}
          </ul>
        </>
      )}

      {(theyWantCards.length > 0 || theyWantProducts.length > 0) && (
        <>
          <h3 className="mb-3 mt-6 font-semibold">{t('Shání, co máš navíc ty')}</h3>
          <ul className={grid}>
            {theyWantCards.map((c) => (
              <Thumb key={c.id} c={c} />
            ))}
            {theyWantProducts.map((p) => (
              <li key={p.id}>
                <ProductTile p={p} />
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-subtle">
            {t('Když si od něj dáš něco do košíku, můžeš k žádosti přidat i své karty navíc na výměnu.')}
          </p>
        </>
      )}
    </section>
  )
}
