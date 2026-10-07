import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { cardImage } from '@/lib/format'

const OFFER = { TRADE: 'vyměním', SELL: 'prodám', GIFT: 'daruji' } as const

/** Hlavní stránka: nejnovější nabídky karet (i pro nepřihlášené — web má působit živě). */
export async function LatestOffers({ take = 12 }: { take?: number }) {
  const offers = await prisma.collectionItem.findMany({
    where: {
      spareQty: { gt: 0 },
      offerType: { not: null },
      hiddenAt: null,
      card: { imageUrl: { not: null } },
      user: { bannedAt: null, OR: [{ isMinor: false }, { parentConsentAt: { not: null } }] },
    },
    include: { card: { include: { set: { select: { name: true } } } }, user: { select: { nickname: true } } },
    orderBy: { updatedAt: 'desc' },
    take,
  })
  if (!offers.length) return null
  return (
    <section className="mb-12">
      <h2 className="mb-4 text-xl font-bold">Nejnovější nabídky</h2>
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
        {offers.map((o) => {
          const img = cardImage(o.card.imageUrl)
          return (
            <li key={o.id}>
              <Link href={`/karta/${encodeURIComponent(o.cardId)}`} className="group block">
                <div className="aspect-[63/88] overflow-hidden rounded-lg bg-slate-200 shadow-sm transition group-hover:-translate-y-0.5 dark:bg-slate-800">
                  {img && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt={o.card.name} loading="lazy" className="h-full w-full object-cover" />
                  )}
                </div>
                <p className="mt-1 truncate text-xs font-medium">{o.card.name}</p>
                <p className="truncate text-xs text-slate-500">{o.card.set.name}</p>
                <p className="truncate text-xs font-semibold text-blue-700 dark:text-blue-400">
                  {o.offerType === 'SELL' && o.priceCzk ? `${o.priceCzk} Kč` : OFFER[o.offerType!]} · {o.user.nickname}
                </p>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
