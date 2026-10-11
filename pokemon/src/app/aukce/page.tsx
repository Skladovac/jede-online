import Link from 'next/link'
import { Gavel, Plus } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { auctionInclude, visibleSeller } from '@/lib/auctions'
import { AuctionCard, AuctionGrid } from '@/components/AuctionCard'
import { MarketNav } from '@/components/MarketNav'
import { EmptyState, btnPrimary } from '@/components/design'
import { getT } from '@/lib/i18n/server'

export async function generateMetadata() {
  const t = await getT()
  return {
    title: t('Aukce'),
    description: t('Aukce Pokémon karet a produktů od sběratelů z Česka a Slovenska — na Facebooku, Aukru, Vintedu a dalších webech, přehledně na jednom místě.'),
  }
}
export const dynamic = 'force-dynamic'

export default async function AuctionsPage() {
  const t = await getT()
  const user = await getCurrentUser()
  const now = new Date()
  const [active, ended] = await Promise.all([
    prisma.auction.findMany({
      where: { hiddenAt: null, endsAt: { gt: now }, user: visibleSeller },
      include: auctionInclude,
      orderBy: { endsAt: 'asc' },
      take: 120,
    }),
    prisma.auction.findMany({
      where: { hiddenAt: null, endsAt: { lte: now, gt: new Date(now.getTime() - 30 * 86_400_000) }, user: visibleSeller },
      include: auctionInclude,
      orderBy: { endsAt: 'desc' },
      take: 24,
    }),
  ])

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-4xl font-extrabold text-fg sm:text-[44px]">{t('Tržiště')}</h1>
        {user && (
          <Link href="/aukce/nova" className={btnPrimary}>
            <Plus aria-hidden />
            {t('Nová aukce')}
          </Link>
        )}
      </div>
      <MarketNav active="aukce" />
      <p className="mt-3 text-sm text-muted">
        {t('Aukce probíhají na Facebooku, Aukru, Vintedu, Bazoši nebo eBayi — tady je najdeš přehledně na jednom místě i s tím, kdy končí.')}
      </p>

      <section className="mt-8">
        {active.length ? (
          <AuctionGrid>
            {active.map((a) => (
              <li key={a.id}>
                <AuctionCard a={a} />
              </li>
            ))}
          </AuctionGrid>
        ) : (
          <EmptyState>
            <p>{t('Teď neprobíhá žádná aukce.')}</p>
            {user ? (
              <Link href="/aukce/nova" className="mt-2 inline-flex items-center gap-1 font-semibold text-accent">
                <Gavel className="h-4 w-4" aria-hidden />
                {t('Založ první aukci')}
              </Link>
            ) : (
              <p className="mt-1">{t('Přihlas se a založ první aukci.')}</p>
            )}
          </EmptyState>
        )}
      </section>

      {ended.length > 0 && (
        <section className="mt-14">
          <h2 className="text-2xl font-bold text-fg">{t('Nedávno skončené')}</h2>
          <p className="mt-1 text-sm text-muted">{t('Odkaz zůstává — podívej se, jak aukce dopadla.')}</p>
          <div className="mt-6">
            <AuctionGrid>
              {ended.map((a) => (
                <li key={a.id}>
                  <AuctionCard a={a} />
                </li>
              ))}
            </AuctionGrid>
          </div>
        </section>
      )}
    </main>
  )
}
