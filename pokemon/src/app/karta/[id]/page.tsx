import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { safeDecode } from '@/lib/validation'
import { cardImage, categoryLabel, formatEur, rarityLabel } from '@/lib/format'
import { PriceNote } from '@/components/PriceNote'
import { PriceStatsTable } from '@/components/PriceStatsTable'
import { eurCzkDate } from '@/lib/fx'
import type { PriceStats } from '@/lib/price-stats'
import { CardOffers } from '@/components/CardOffers'
import { CardBuyers } from '@/components/Buyers'
import { MyCardPanel } from '@/components/MyCardPanel'
import { ensureEurCzk } from '@/lib/fx'
import { getT, getLocale } from '@/lib/i18n/server'
import { LOCALE_INFO } from '@/lib/i18n/config'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

async function getCard(id: string) {
  return prisma.card.findUnique({ where: { id: (safeDecode(id) ?? '') }, include: { set: true } })
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const card = await getCard((await params).id)
  const t = await getT()
  return { title: card ? `${card.name} (${card.set.name} ${card.localId})` : t('Karta nenalezena') }
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
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Link href={setHref} className="text-sm text-slate-500 hover:underline">
        ← {card.set.name}
      </Link>
      <div className="mt-6 grid gap-8 md:grid-cols-[minmax(0,360px)_1fr]">
        <div className="mx-auto aspect-[63/88] w-full max-w-[360px] overflow-hidden rounded-2xl bg-slate-200 shadow-lg dark:bg-slate-800">
          {img && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt={card.name} className="h-full w-full object-cover" />
          )}
        </div>
        <div>
          <h1 className="text-3xl font-black tracking-tight">{card.name}</h1>
          <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
            <dt className="text-slate-500">{t('Sada')}</dt>
            <dd>
              <Link href={setHref} className="font-medium hover:underline">
                {card.set.name}
              </Link>
            </dd>
            <dt className="text-slate-500">{t('Číslo')}</dt>
            <dd className="font-mono">
              {card.set.code ? `${card.set.code} ` : ''}
              {card.localId}/{card.set.officialCount}
            </dd>
            {card.rarity && (
              <>
                <dt className="text-slate-500">{t('Vzácnost')}</dt>
                <dd>{t(rarityLabel(card.rarity)!)}</dd>
              </>
            )}
            {card.category && (
              <>
                <dt className="text-slate-500">{t('Typ')}</dt>
                <dd>{t(categoryLabel(card.category))}</dd>
              </>
            )}
            {variants.length > 0 && (
              <>
                <dt className="text-slate-500">{t('Varianty')}</dt>
                <dd className="flex flex-wrap gap-1.5">
                  {variants.map((v) => (
                    <span key={v} className="rounded-full bg-slate-200 px-2 py-0.5 text-xs dark:bg-slate-800">
                      {v}
                    </span>
                  ))}
                </dd>
              </>
            )}
          </dl>

          <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{t('Orientační cena')}</h2>
            {price || priceReverse ? (
              <div className="mt-3 flex flex-wrap gap-8">
                {price && (
                  <div>
                    <p className="text-2xl font-bold">≈ {price}</p>
                    <p className="text-xs text-slate-500">{card.hasHolo && !card.hasNormal ? 'holo' : t('běžná verze')}</p>
                  </div>
                )}
                {priceReverse && (
                  <div>
                    <p className="text-2xl font-bold">≈ {priceReverse}</p>
                    <p className="text-xs text-slate-500">reverse holo</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-3 text-slate-500">{t('Cena zatím není k dispozici.')}</p>
            )}
            {(() => {
              const stats = card.priceStats as PriceStats | null
              return stats ? (
                <div className="mt-5 grid gap-5 border-t border-slate-200 pt-4 dark:border-slate-800 sm:grid-cols-2">
                  <PriceStatsTable stats={stats} title={stats.reverse ? t('Běžná verze') : 'Cardmarket'} />
                  {stats.reverse && <PriceStatsTable stats={stats.reverse} title="Reverse holo" />}
                </div>
              ) : null
            })()}
            <PriceNote className="mt-4" />
            <p className="mt-1 text-xs text-slate-400">
              {card.priceUpdatedAt && <>{t('Ceny z {date}', { date: card.priceUpdatedAt.toLocaleDateString(LOCALE_INFO[locale].intl) })}</>}
              {eurCzkDate() && <> · {t('kurz ČNB ze dne {date}', { date: eurCzkDate()! })}</>}
            </p>
          </section>
        </div>
      </div>
      <MyCardPanel card={card} />
      <CardOffers cardId={card.id} />
      <CardBuyers cardId={card.id} />
    </main>
  )
}
