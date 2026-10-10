import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { cardImage } from '@/lib/format'
import { CardImg } from '@/components/CardImg'
import { Badge, SectionHeader, panelInteractive } from '@/components/design'
import { getT } from '@/lib/i18n/server'

const TYPE = {
  SELL: { label: 'Prodej', tone: 'accent' },
  TRADE: { label: 'Výměna', tone: 'warning' },
  GIFT: { label: 'Za poštovné', tone: 'positive' },
} as const

/**
 * Hlavní stránka: nejnovější nabídky karet jako karty tržiště (i pro nepřihlášené — web má působit živě).
 * Výběr je jen prezentační: z posledních nabídek nejvýš 2 od jednoho sběratele, ať homepage neovládne jeden účet.
 */
export async function LatestOffers({ take = 6, note }: { take?: number; note?: React.ReactNode }) {
  const t = await getT()
  const recent = await prisma.collectionItem.findMany({
    where: {
      spareQty: { gt: 0 },
      offerType: { not: null },
      hiddenAt: null,
      card: { imageUrl: { not: null } },
      user: { bannedAt: null, OR: [{ isMinor: false }, { parentConsentAt: { not: null } }] },
    },
    include: {
      card: { include: { set: { select: { name: true, code: true, officialCount: true } } } },
      user: { select: { id: true, nickname: true } },
    },
    orderBy: { offeredAt: { sort: 'desc', nulls: 'last' } },
    take: 60,
  })
  const perUser = new Map<string, number>()
  const offers = recent
    .filter((o) => {
      const n = perUser.get(o.userId) ?? 0
      perUser.set(o.userId, n + 1)
      return n < 2
    })
    .slice(0, take)
  if (!offers.length) return null

  // Hodnocení prodávajících jedním dotazem.
  const ratings = await prisma.rating.groupBy({
    by: ['toId', 'positive'],
    where: { toId: { in: [...new Set(offers.map((o) => o.userId))] }, hiddenAt: null, from: { bannedAt: null } },
    _count: true,
  })
  const rating = (id: string) => {
    const pos = ratings.find((r) => r.toId === id && r.positive)?._count ?? 0
    const neg = ratings.find((r) => r.toId === id && !r.positive)?._count ?? 0
    return pos + neg ? Math.round((pos / (pos + neg)) * 100) : null
  }

  return (
    <section>
      <SectionHeader title={t('Nejnovější nabídky')} href="/trziste" linkLabel={t('Celé tržiště')} sub={note} />
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
        {offers.map((o) => {
          const type = TYPE[o.offerType!]
          const pct = rating(o.userId)
          const number = `${o.card.set.code ? `${o.card.set.code} ` : ''}${o.card.localId}${o.card.set.officialCount ? `/${o.card.set.officialCount}` : ''}`
          return (
            <li key={o.id}>
              <Link href={`/karta/${encodeURIComponent(o.cardId)}`} className={`${panelInteractive} group flex h-full flex-col p-2.5`}>
                <div className="aspect-[63/88] overflow-hidden rounded-lg bg-surface">
                  <CardImg src={cardImage(o.card.imageUrl)} alt={o.card.name} />
                </div>
                <div className="mt-2.5 flex min-w-0 flex-1 flex-col gap-1 px-0.5">
                  <span className="self-start">
                    <Badge tone={type.tone}>{t(type.label)}</Badge>
                  </span>
                  <p className="truncate text-sm font-semibold text-fg" title={o.card.name}>
                    {o.card.name}
                  </p>
                  <p className="truncate text-xs text-muted" title={o.card.set.name}>
                    {o.card.set.name} · <span className="tabular-nums">{number}</span>
                  </p>
                  <p className="mt-auto pt-1 text-base font-bold tabular-nums text-fg">
                    {o.offerType === 'SELL' ? (o.priceCzk ? `${o.priceCzk.toLocaleString('cs-CZ')} Kč` : t('cena dohodou')) : o.offerType === 'GIFT' ? t('zdarma') : t('na výměnu')}
                  </p>
                  <p className="flex items-center gap-1 truncate text-xs text-subtle">
                    <span className="truncate">{o.user.nickname}</span>
                    {pct !== null && <span className="shrink-0 tabular-nums">· 👍 {pct} %</span>}
                  </p>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
