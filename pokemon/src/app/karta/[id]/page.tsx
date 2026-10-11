import type { Metadata } from 'next'
import Link from 'next/link'
import { AuctionSection } from '@/components/AuctionCard'
import { ChevronRight } from 'lucide-react'
import { panel } from '@/components/design'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { safeDecode } from '@/lib/validation'
import { cardImage, categoryLabel, formatEur, rarityLabel } from '@/lib/format'
import { PriceNote } from '@/components/PriceNote'
import { PriceStatsTable } from '@/components/PriceStatsTable'
import { PriceChart } from '@/components/PriceChart'
import { eurCzkDate } from '@/lib/fx'
import type { PriceStats } from '@/lib/price-stats'
import { CardOffers } from '@/components/CardOffers'
import { CardBuyers } from '@/components/Buyers'
import { MyCardPanel } from '@/components/MyCardPanel'
import { ensureEurCzk } from '@/lib/fx'
import { getT, getLocale } from '@/lib/i18n/server'
import { LOCALE_INFO } from '@/lib/i18n/config'
import { TypeBadge } from '@/components/TypeBadge'
import { setDisplayName } from '@/lib/format'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

async function getCard(id: string) {
  return prisma.card.findUnique({ where: { id: (safeDecode(id) ?? '') }, include: { set: true } })
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const card = await getCard((await params).id)
  const t = await getT()
  if (!card) return { title: t('Karta nenalezena') }
  await ensureEurCzk() // cena v Kč do popisu
  // Popis pro Google: cena a kolik lidí kartu nabízí nebo chce koupit.
  const [offers, buyers] = await Promise.all([
    prisma.collectionItem.count({ where: { cardId: card.id, spareQty: { gt: 0 }, offerType: { not: null }, hiddenAt: null } }),
    prisma.wantItem.count({ where: { cardId: card.id, buy: true } }),
  ])
  const price = card.priceEur ? formatEur(card.priceEur) : null
  const title = t('{name} ({set} {num}) – cena a kdo ji nabízí', { name: card.name, set: setDisplayName(card.set), num: card.localId })
  const description = [
    price && t('Orientační cena {price}.', { price }),
    offers ? t('Nabízí ji {n} sběratelů z Česka a Slovenska.', { n: offers }) : t('Najdi sběratele, kteří ji nabízejí.'),
    buyers && t('Koupit ji chce {n} sběratelů.', { n: buyers }),
    t('Zdarma si veď sbírku a vyměňuj karty.'),
  ]
    .filter(Boolean)
    .join(' ')
  const img = cardImage(card.imageUrl, 'high')
  return { title, description, openGraph: { title, description, ...(img && { images: [img.startsWith('/') ? `https://pokemon.jede.online${img}` : img] }) } }
}

export default async function CardPage({ params }: Props) {
  await ensureEurCzk() // kurz ČNB pro korunové částky u cen
  const t = await getT()
  const locale = await getLocale()
  const card = await getCard((await params).id)
  if (!card) notFound()

  const img = cardImage(card.imageUrl, 'high')
  const variants = [
    card.hasNormal && t('Normální'),
    card.hasHolo && 'Holo',
    card.hasReverse && 'Reverse holo',
    card.hasFirstEd && '1st edition',
    card.hasPokeball && 'Poké Ball reverse',
    card.hasMasterball && 'Master Ball reverse',
  ].filter(Boolean) as string[]
  const price = formatEur(card.priceEur)
  const priceReverse = formatEur(card.priceReverseEur)
  const setHref = `/sady/${encodeURIComponent(card.setId)}`

  return (
    <main className="mx-auto max-w-page px-4 pb-10 pt-6 sm:px-6">
      <nav aria-label={t('Drobečková navigace')} className="flex items-center gap-1.5 text-sm text-subtle">
        <Link href="/sady" className="text-muted hover:text-fg">
          {t('Sady')}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        <Link href={setHref} className="text-muted hover:text-fg">
          {setDisplayName(card.set)}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        <span className="truncate text-fg">{card.name}</span>
      </nav>
      <div className="mt-6 grid gap-10 md:grid-cols-[minmax(0,400px)_1fr] lg:gap-14">
        {img ? (
          // Přirozený poměr stran: karty tištěné naležato (BREAK, LEGEND) se zobrazí celé, neořízlé.
          <div className="relative mx-auto w-full max-w-[400px] self-start">
            <div aria-hidden className="pointer-events-none absolute -inset-10 rounded-full bg-[radial-gradient(closest-side,rgba(255,203,5,0.28),transparent_72%)] dark:opacity-50" />
            <div className="relative overflow-hidden rounded-[4.5%/3.2%] bg-surface shadow-[0_2px_2px_rgba(14,27,46,0.1),0_30px_50px_-18px_rgba(14,27,46,0.55)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img} alt={card.name} className="block h-auto w-full" />
            </div>
          </div>
        ) : (
          <div className="mx-auto aspect-[63/88] w-full max-w-[400px] overflow-hidden rounded-[4.5%/3.2%] bg-surface shadow-card" />
        )}
        <div>
          <p className="eyebrow">
            {setDisplayName(card.set)} · {card.set.code ? `${card.set.code} ` : ''}
            {card.localId}
            {card.set.officialCount ? `/${card.set.officialCount}` : ''}
          </p>
          <h1 className="mt-2 text-4xl font-extrabold text-fg sm:text-5xl">{card.name}</h1>
          {card.nameOriginal && card.nameOriginal !== card.name && <p className="text-sm text-subtle">{card.nameOriginal}</p>}
          <dl className="mt-7 grid grid-cols-[auto_1fr] gap-x-8 gap-y-3.5 border-t border-line pt-6 text-[15px]">
            <dt className="text-subtle">{t('Sada')}</dt>
            <dd>
              <Link href={setHref} className="font-medium hover:underline">
                {setDisplayName(card.set)}
              </Link>
            </dd>
            <dt className="text-subtle">{t('Číslo')}</dt>
            <dd className="font-mono">
              {card.set.code ? `${card.set.code} ` : ''}
              {card.localId}
              {card.set.officialCount ? `/${card.set.officialCount}` : ''}
            </dd>
            {card.rarity && card.rarity !== 'None' && (
              <>
                <dt className="text-subtle">{t('Vzácnost')}</dt>
                <dd>{t(rarityLabel(card.rarity)!)}</dd>
              </>
            )}
            {card.category && (
              <>
                <dt className="text-subtle">{t('Typ')}</dt>
                <dd className="flex flex-wrap items-center gap-1.5">
                  {t(categoryLabel(card.category))}
                  {card.types.map((ty) => (
                    <TypeBadge key={ty} type={ty} />
                  ))}
                </dd>
              </>
            )}
            {variants.length > 0 && (
              <>
                <dt className="text-subtle">{t('Varianty')}</dt>
                <dd className="flex flex-wrap gap-1.5">
                  {variants.map((v) => (
                    <span key={v} className="rounded-[7px] bg-surface px-2 py-0.5 text-xs font-semibold text-muted ring-1 ring-inset ring-line">
                      {v}
                    </span>
                  ))}
                </dd>
              </>
            )}
          </dl>

          <section className={`${panel} mt-8 p-6`}>
            <h2 className="eyebrow">{t('Orientační cena')}</h2>
            {price || priceReverse ? (
              <div className="mt-3 flex flex-wrap gap-8">
                {price && (
                  <div>
                    <p className="font-display text-3xl font-bold tabular-nums text-fg">≈ {price}</p>
                    <p className="text-xs text-subtle">{card.hasHolo && !card.hasNormal ? 'holo' : t('běžná verze')}</p>
                  </div>
                )}
                {priceReverse && (
                  <div>
                    <p className="font-display text-3xl font-bold tabular-nums text-fg">≈ {priceReverse}</p>
                    <p className="text-xs text-subtle">reverse holo</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-3 text-subtle">{t('Cena zatím není k dispozici.')}</p>
            )}
            {(() => {
              const stats = card.priceStats as PriceStats | null
              return stats ? (
                <div className="mt-5 grid gap-5 border-t border-line pt-4 sm:grid-cols-2">
                  <PriceStatsTable stats={stats} title={stats.reverse ? t('Běžná verze') : 'Cardmarket'} />
                  {stats.reverse && <PriceStatsTable stats={stats.reverse} title="Reverse holo" />}
                </div>
              ) : null
            })()}
            <PriceChart cardId={card.id} stats={card.priceStats as PriceStats | null} />
            <PriceNote className="mt-4" />
            <p className="mt-1 text-xs text-subtle">
              {card.priceUpdatedAt && <>{t('Ceny z {date}', { date: card.priceUpdatedAt.toLocaleDateString(LOCALE_INFO[locale].intl) })}</>}
              {eurCzkDate() && <> · {t('kurz ČNB ze dne {date}', { date: eurCzkDate()! })}</>}
            </p>
          </section>
        </div>
      </div>
      <MyCardPanel card={card} />
      <CardOffers cardId={card.id} />
      <CardBuyers cardId={card.id} />
      <AuctionSection where={{ items: { some: { cardId: card.id } } }} />
    </main>
  )
}
