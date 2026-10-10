import Link from 'next/link'
import type { pairMatches } from '@/lib/matches'
import { cardImage } from '@/lib/format'
import { AddToCart } from '@/components/AddToCart'
import { ProductTile } from '@/components/ProductTile'
import { getT } from '@/lib/i18n/server'
import { CardImg } from '@/components/CardImg'
import { Badge, panel } from '@/components/design'
import { Repeat } from 'lucide-react'

type Data = Awaited<ReturnType<typeof pairMatches>>
type MiniCard = { id: string; name: string; localId: string; imageUrl: string | null; set: { name: string } }

const OFFER = { TRADE: 'vyměním', SELL: 'prodám', GIFT: 'daruji' } as const

function Thumb({ c, children }: { c: MiniCard; children?: React.ReactNode }) {
  const img = cardImage(c.imageUrl)
  return (
    <li>
      <Link href={`/karta/${encodeURIComponent(c.id)}`} className="card-tile group block">
        <div className="card-frame aspect-[63/88]">
          {img && (
            <CardImg src={img} alt={c.name} />
          )}
        </div>
        <p className="mt-2 truncate text-[13px] font-semibold text-fg">{c.name}</p>
        <p className="flex items-baseline gap-1 truncate text-xs text-muted">
          <span className="truncate">{c.set.name}</span>
          <span className="shrink-0 font-mono text-[11.5px] text-subtle">{c.localId}</span>
        </p>
      </Link>
      {children}
    </li>
  )
}

const grid = 'grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-4 md:grid-cols-6'

/** Na profilu cizího sběratele: co z toho, co mi chybí, má on a co on shání ode mě. */
export async function MatchSection({ data, nickname, proposal }: { data: Data; nickname: string; proposal?: React.ReactNode }) {
  const t = await getT()
  const { offeredCards, ownedCards, offeredProducts, theyWantCards, theyWantProducts } = data
  if (!offeredCards.length && !ownedCards.length && !offeredProducts.length && !theyWantCards.length && !theyWantProducts.length)
    return null
  const trade = (offeredCards.length || offeredProducts.length) > 0 && (theyWantCards.length || theyWantProducts.length) > 0

  return (
    <section id="shoda" className={`${panel} mt-10 scroll-mt-24 p-4 sm:p-6`}>
      <h2 className="flex flex-wrap items-center gap-2 text-2xl font-bold text-fg">
        {t('Shoda s tebou')}
        {trade && (
          <Badge tone="positive">
            <Repeat aria-hidden />
            {t('Výměna možná')}
          </Badge>
        )}
      </h2>

      {proposal}

      {(offeredCards.length > 0 || offeredProducts.length > 0) && (
        <>
          <h3 className="mb-3 mt-6 text-lg font-bold text-fg">{t('Nabízí, co ti chybí')}</h3>
          <ul className={grid}>
            {offeredCards.map((i) => (
              <Thumb key={i.id} c={i.card}>
                <p className="mt-1 text-xs font-semibold tabular-nums text-accent">
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
                <p className="mt-1 text-xs font-semibold tabular-nums text-accent">
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
          <h3 className="mb-1 mt-8 text-lg font-bold text-fg">{t('Má ve sbírce, ale nenabízí')}</h3>
          <p className="mb-3 text-xs text-muted">
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
          <h3 className="mb-3 mt-8 text-lg font-bold text-fg">{t('Shání, co máš navíc ty')}</h3>
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
          <p className="mt-3 text-xs text-muted">
            {t('Když si od něj dáš něco do košíku, můžeš k žádosti přidat i své karty navíc na výměnu.')}
          </p>
        </>
      )}
    </section>
  )
}
