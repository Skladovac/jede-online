import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { cardImage } from '@/lib/format'
import { CardImg } from '@/components/CardImg'
import { Badge, SectionHeader } from '@/components/design'
import { ArrowLeftRight, Gift, Tag, ThumbsUp } from 'lucide-react'
import { getT } from '@/lib/i18n/server'

const TYPE = {
  SELL: { label: 'Prodej', tone: 'green', icon: Tag },
  TRADE: { label: 'Výměna', tone: 'blue', icon: ArrowLeftRight },
  GIFT: { label: 'Za poštovné', tone: 'yellow', icon: Gift },
} as const

/**
 * Hlavní stránka: nejnovější nabídky karet jako karty tržiště (i pro nepřihlášené — web má působit živě).
 * Výběr je jen prezentační: z posledních nabídek nejvýš 2 od jednoho sběratele, ať homepage neovládne jeden účet.
 */
export async function LatestOffers({ take = 6, note }: { take?: number; note?: React.ReactNode }) {
  const t = await getT()
  const where = {
    spareQty: { gt: 0 },
    offerType: { not: null },
    hiddenAt: null,
    card: { imageUrl: { not: null } },
    user: { bannedAt: null, OR: [{ isMinor: false }, { parentConsentAt: { not: null } }] },
  }
  // Nejvýš 2 nabídky od jednoho sběratele: napřed sběratelé s nejčerstvější nabídkou, pak jejich 2 poslední nabídky.
  // (Postgres řadí NULL u DESC napřed, proto řazení v JS: nabídky bez data až na konec.)
  // Omezeno v databázi (LIMIT), ať dotaz neroste s počtem sběratelů; rezerva pro sběratele s NULL datem.
  const sellers = (
    await prisma.collectionItem.groupBy({ by: ['userId'], where, _max: { offeredAt: true }, orderBy: { _max: { offeredAt: 'desc' } }, take: take * 5 })
  )
    .sort((a, b) => (b._max.offeredAt?.getTime() ?? 0) - (a._max.offeredAt?.getTime() ?? 0))
    .slice(0, take)
  const include = {
    card: { include: { set: { select: { name: true, code: true, officialCount: true } } } },
    user: { select: { id: true, nickname: true } },
  }
  const perSeller = await Promise.all(
    sellers.map((s) =>
      prisma.collectionItem.findMany({ where: { ...where, userId: s.userId }, include, orderBy: { offeredAt: { sort: 'desc', nulls: 'last' } }, take: 2 }),
    ),
  )
  // Napřed nejnovější nabídka každého sběratele, druhé nabídky až potom (pestřejší výběr).
  const offers = [...perSeller.map((l) => l[0]), ...perSeller.map((l) => l[1])].filter((o): o is NonNullable<typeof o> => !!o).slice(0, take)
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
      <ul className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 sm:gap-x-7 lg:grid-cols-6">
        {offers.map((o) => {
          const type = TYPE[o.offerType!]
          const pct = rating(o.userId)
          const number = `${o.card.set.code ? `${o.card.set.code} ` : ''}${o.card.localId}${o.card.set.officialCount ? `/${o.card.set.officialCount}` : ''}`
          return (
            <li key={o.id}>
              <Link href={`/karta/${encodeURIComponent(o.cardId)}`} className="card-tile group flex h-full flex-col">
                <div className="card-frame aspect-[63/88]">
                  <CardImg src={cardImage(o.card.imageUrl)} alt={o.card.name} />
                </div>
                <div className="mt-3 flex items-baseline justify-between gap-2">
                  <p className="truncate text-[14.5px] font-semibold text-fg" title={o.card.name}>
                    {o.card.name}
                  </p>
                  <span className="shrink-0 font-mono text-[11px] text-subtle">{number}</span>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted" title={o.card.set.name}>
                  {o.card.set.name}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Badge tone={type.tone}>
                    <type.icon aria-hidden />
                    {o.offerType === 'SELL' ? (o.priceCzk ? `${o.priceCzk.toLocaleString('cs-CZ')} Kč` : t('cena dohodou')) : t(type.label)}
                  </Badge>
                </div>
                <p className="mt-2 flex items-center gap-1.5 truncate text-xs text-subtle">
                  <span aria-hidden className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-[var(--ink)] text-[9px] font-extrabold text-brand-yellow dark:bg-brand-yellow dark:text-[var(--ink)]">
                    {o.user.nickname.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="truncate font-medium text-muted">{o.user.nickname}</span>
                  {pct !== null && (
                    <span className="flex shrink-0 items-center gap-0.5 tabular-nums">
                      · <ThumbsUp className="h-3 w-3" aria-hidden /> {pct} %
                    </span>
                  )}
                </p>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
