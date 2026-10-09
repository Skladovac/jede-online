import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { AddToCart } from '@/components/AddToCart'
import { getT } from '@/lib/i18n/server'
import { BadgeIcon } from '@/components/Badges'

const VARIANT = { NORMAL: 'Normální', HOLO: 'Holo', REVERSE: 'Reverse holo', FIRST_EDITION: '1st edition', POKEBALL: 'Poké Ball reverse', MASTERBALL: 'Master Ball reverse' } as const
const CONDITION = { MINT: 'Jako nová', LIGHT_PLAYED: 'Mírně hraná', DAMAGED: 'Poškozená' } as const
// Pořadí: nejdřív dary, pak prodej od nejlevnějšího, nakonec výměny.
const OFFER_ORDER = { GIFT: 0, SELL: 1, TRADE: 2 } as const

/** Kdo kartu nabízí (kusy "navíc" ve sbírkách). Omezené a zablokované účty se nezobrazují. */
export async function CardOffers({ cardId }: { cardId: string }) {
  const t = await getT()
  const viewer = await getCurrentUser()
  const offers = await prisma.collectionItem.findMany({
    where: {
      cardId,
      spareQty: { gt: 0 },
      offerType: { not: null },
      hiddenAt: null,
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
      <h2 className="text-xl font-bold">{t('Kdo ji nabízí')}</h2>
      {offers.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed border-slate-300 p-6 text-center text-slate-500 dark:border-slate-700">
          {t('Zatím ji nikdo nenabízí. Až si ji někdo přidá do sbírky jako „navíc“, objeví se tady.')}
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          {offers.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
              <div className="min-w-0 flex-1">
                <Link href={`/@${encodeURIComponent(o.user.nickname)}`} className="font-semibold hover:underline">
                  {o.user.nickname}
                </Link>{' '}
                <BadgeIcon nickname={o.user.nickname} />
                {viewer && viewer.id !== o.userId && (
                  <Link
                    href={`/@${encodeURIComponent(o.user.nickname)}?nahlasit=1#nahlasit`}
                    className="ml-2 text-xs text-slate-400 hover:text-red-600 hover:underline"
                  >
                    {t('nahlásit')}
                  </Link>
                )}
                <span className="text-sm text-slate-500"> · {o.user.city ?? o.user.region ?? t('neuvedeno')}</span>
                <p className="text-xs text-slate-500">
                  {[t(VARIANT[o.variant]), t(CONDITION[o.condition]), o.language.toUpperCase(), o.spareQty > 1 && t('{n} ks', { n: o.spareQty })]
                    .filter(Boolean)
                    .join(' · ')}
                  {o.note && <span className="italic"> · „{o.note}“</span>}
                </p>
              </div>
              <span className="flex items-center gap-3 font-semibold">
                {o.offerType === 'SELL' && o.priceCzk != null
                  ? `${o.priceCzk.toLocaleString('cs-CZ')} Kč`
                  : o.offerType === 'GIFT'
                    ? t('Daruji za poštovné')
                    : t('Vyměním')}
                {viewer && viewer.id !== o.userId ? (
                  <AddToCart collectionItemId={o.id} />
                ) : !viewer ? (
                  <Link href="/prihlaseni" className="text-sm font-normal underline">
                    {t('Přihlas se')}
                  </Link>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
