import Link from 'next/link'
import { prisma } from '@/lib/prisma'

const VARIANT = { NORMAL: 'Normální', HOLO: 'Holo', REVERSE: 'Reverse holo', FIRST_EDITION: '1st edition' } as const
const CONDITION = { MINT: 'Jako nová', LIGHT_PLAYED: 'Mírně hraná', DAMAGED: 'Poškozená' } as const
// Pořadí: nejdřív dary, pak prodej od nejlevnějšího, nakonec výměny.
const OFFER_ORDER = { GIFT: 0, SELL: 1, TRADE: 2 } as const

/** Kdo kartu nabízí (kusy "navíc" ve sbírkách). Omezené a zablokované účty se nezobrazují. */
export async function CardOffers({ cardId }: { cardId: string }) {
  const offers = await prisma.collectionItem.findMany({
    where: {
      cardId,
      spareQty: { gt: 0 },
      offerType: { not: null },
      user: { bannedAt: null, OR: [{ isMinor: false }, { parentConsentAt: { not: null } }] },
    },
    include: { user: { select: { nickname: true, city: true, region: true } } },
    take: 100,
  })
  offers.sort(
    (a, b) =>
      OFFER_ORDER[a.offerType!] - OFFER_ORDER[b.offerType!] || (a.priceCzk ?? Infinity) - (b.priceCzk ?? Infinity),
  )

  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold">Kdo ji nabízí</h2>
      {offers.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed border-slate-300 p-6 text-center text-slate-500 dark:border-slate-700">
          Zatím ji nikdo nenabízí. Až si ji někdo přidá do sbírky jako „navíc“, objeví se tady.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          {offers.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
              <div className="min-w-0 flex-1">
                <Link href={`/u/${encodeURIComponent(o.user.nickname)}`} className="font-semibold hover:underline">
                  {o.user.nickname}
                </Link>
                <span className="text-sm text-slate-500"> · {o.user.city ?? o.user.region ?? 'neuvedeno'}</span>
                <p className="text-xs text-slate-500">
                  {[VARIANT[o.variant], CONDITION[o.condition], o.language.toUpperCase(), o.spareQty > 1 && `${o.spareQty} ks`]
                    .filter(Boolean)
                    .join(' · ')}
                  {o.note && <span className="italic"> · „{o.note}“</span>}
                </p>
              </div>
              <span className="font-semibold">
                {o.offerType === 'SELL' && o.priceCzk != null
                  ? `${o.priceCzk.toLocaleString('cs-CZ')} Kč`
                  : o.offerType === 'GIFT'
                    ? 'Daruji za poštovné'
                    : 'Vyměním'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
