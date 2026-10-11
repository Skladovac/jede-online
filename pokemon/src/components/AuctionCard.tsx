import Link from 'next/link'
import { Gavel } from 'lucide-react'
import { CardImg } from '@/components/CardImg'
import { AuctionCountdown } from '@/components/AuctionCountdown'
import { cardImage, productImage } from '@/lib/format'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { auctionInclude, auctionSite, visibleSeller, type AuctionFull } from '@/lib/auctions'
import { getT } from '@/lib/i18n/server'

/** Dlaždice aukce: obrázek první položky (+ počet dalších), název, web, odpočet / „skončila“, vyvolávací cena. */
export async function AuctionCard({ a, showSeller = true }: { a: AuctionFull; showSeller?: boolean }) {
  const t = await getT()
  const first = a.items[0]
  const img = first?.card ? cardImage(first.card.imageUrl) : first?.product ? productImage(first.product.imageUrl) : null
  const ended = a.endsAt.getTime() <= Date.now()
  return (
    <Link href={`/aukce/${a.id}`} className="card-tile group flex h-full flex-col">
      <div className={`card-frame relative aspect-[63/88] ${ended ? 'opacity-70 grayscale-[0.6] transition duration-300 group-hover:opacity-100 group-hover:grayscale-0' : ''}`}>
        {img ? <CardImg src={img} alt={first?.card?.name ?? first?.product?.name ?? ''} /> : <div className="grid h-full place-items-center text-subtle"><Gavel className="h-8 w-8" aria-hidden /></div>}
        {a.items.length > 1 && (
          <span className="absolute bottom-1.5 right-1.5 z-10 rounded-full bg-[var(--ink)] px-2 py-0.5 font-mono text-[11px] font-bold text-brand-yellow shadow">
            +{a.items.length - 1}
          </span>
        )}
      </div>
      <div className="mt-3 flex items-center gap-1.5">
        <span
          className={`inline-flex items-center gap-1 rounded-[7px] px-2 py-0.5 text-[11.5px] font-semibold ring-1 ring-inset ${
            ended
              ? 'bg-surface text-muted ring-line'
              : 'bg-[#fff6d6] text-[#7a5600] ring-[#f5e19a] dark:bg-[rgba(255,203,5,0.12)] dark:text-[#ffd95c] dark:ring-[rgba(255,203,5,0.3)]'
          }`}
        >
          <Gavel className="h-3 w-3" aria-hidden />
          <AuctionCountdown endsAt={a.endsAt.toISOString()} />
        </span>
        <span className="truncate text-[11.5px] text-subtle">{auctionSite(a.url)}</span>
      </div>
      <p className="mt-1.5 line-clamp-2 text-[14.5px] font-semibold leading-snug text-fg">{a.title}</p>
      {a.startPriceCzk != null && (
        <p className="mt-0.5 text-[13px] tabular-nums text-muted">{t('vyvolávací cena {price} Kč', { price: a.startPriceCzk.toLocaleString('cs-CZ') })}</p>
      )}
      {showSeller && <p className="mt-1 truncate text-xs text-subtle">{a.user.nickname}</p>}
    </Link>
  )
}

/** Mřížka aukcí. */
export function AuctionGrid({ children }: { children: React.ReactNode }) {
  return <ul className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 sm:gap-x-7 lg:grid-cols-5 xl:grid-cols-6">{children}</ul>
}

/**
 * Blok aukcí pro detail karty / produktu / profil: probíhající napřed, pak pár nedávno skončených (archiv).
 * Nic nevykreslí, když žádná aukce není.
 */
export async function AuctionSection({ where, showSeller = true, limitEnded = 6 }: { where: Prisma.AuctionWhereInput; showSeller?: boolean; limitEnded?: number }) {
  const t = await getT()
  const now = new Date()
  const base = { ...where, hiddenAt: null, user: visibleSeller }
  const [active, ended] = await Promise.all([
    prisma.auction.findMany({ where: { ...base, endsAt: { gt: now } }, include: auctionInclude, orderBy: { endsAt: 'asc' }, take: 12 }),
    prisma.auction.findMany({ where: { ...base, endsAt: { lte: now } }, include: auctionInclude, orderBy: { endsAt: 'desc' }, take: limitEnded }),
  ])
  if (!active.length && !ended.length) return null
  return (
    <section className="mt-12">
      <h2 className="flex items-center gap-2 text-2xl font-bold text-fg">
        <Gavel className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        {t('Aukce')}
      </h2>
      {active.length > 0 && (
        <div className="mt-5">
          <AuctionGrid>
            {active.map((a) => (
              <li key={a.id}>
                <AuctionCard a={a} showSeller={showSeller} />
              </li>
            ))}
          </AuctionGrid>
        </div>
      )}
      {ended.length > 0 && (
        <>
          <p className="eyebrow mt-8">{t('Skončené aukce')}</p>
          <div className="mt-4">
            <AuctionGrid>
              {ended.map((a) => (
                <li key={a.id}>
                  <AuctionCard a={a} showSeller={showSeller} />
                </li>
              ))}
            </AuctionGrid>
          </div>
        </>
      )}
    </section>
  )
}
