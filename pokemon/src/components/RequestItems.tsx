import Link from 'next/link'
import type { TradeRequestItem } from '@prisma/client'
import { cardImage, productImage } from '@/lib/format'

const OFFER = { TRADE: 'výměna', SELL: 'prodej', GIFT: 'dar za poštovné' } as const

/** Seznam položek poptávky (karty) se součtem ceny za prodávané kusy. */
export function RequestItems({
  items,
  action,
}: {
  items: TradeRequestItem[]
  action?: (item: TradeRequestItem) => React.ReactNode
}) {
  const total = items.reduce((s, i) => s + (i.offerType === 'SELL' && i.priceCzk ? i.priceCzk * i.quantity : 0), 0)
  return (
    <div>
      <ul className="divide-y divide-slate-200 dark:divide-slate-800">
        {items.map((i) => {
          const img = i.productId ? productImage(i.imageUrl) : cardImage(i.imageUrl)
          return (
            <li key={i.id} className="flex items-center gap-3 py-3">
              <span className="h-16 w-12 shrink-0 overflow-hidden rounded bg-slate-200 dark:bg-slate-800">
                {img && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img} alt="" className={`h-full w-full ${i.productId ? 'bg-white object-contain' : 'object-cover'}`} />
                )}
              </span>
              <div className="min-w-0 flex-1">
                {i.productId ? (
                  <Link href={`/produkt/${i.productId}`} className="font-medium hover:underline">
                    {i.title}
                  </Link>
                ) : i.cardId ? (
                  <Link href={`/karta/${encodeURIComponent(i.cardId)}`} className="font-medium hover:underline">
                    {i.title}
                  </Link>
                ) : (
                  <span className="font-medium">{i.title}</span>
                )}
                <p className="text-xs text-slate-500">{i.detail}</p>
              </div>
              <div className="shrink-0 text-right text-sm">
                <p className="font-semibold">
                  {i.quantity}× {i.offerType === 'SELL' && i.priceCzk ? `${i.priceCzk} Kč` : OFFER[i.offerType ?? 'TRADE']}
                </p>
                {action?.(i)}
              </div>
            </li>
          )
        })}
      </ul>
      {total > 0 && <p className="mt-2 text-right text-sm font-semibold">Za prodávané kusy celkem: {total} Kč</p>}
    </div>
  )
}
