import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { CONDITION_LABEL, VARIANT_LABEL } from '@/lib/labels'
import { getT } from '@/lib/i18n/server'
import { BadgeIcon } from '@/components/Badges'
import { EmptyState, panel } from '@/components/design'
import { Coins } from 'lucide-react'

const visibleUser = { bannedAt: null, OR: [{ isMinor: false }, { parentConsentAt: { not: null } }] }

type Row = {
  id: string
  maxPriceCzk: number | null
  detail: string[]
  user: { nickname: string; city: string | null; region: string | null }
}

async function BuyersList({ rows, kind }: { rows: Row[]; kind: 'card' | 'product' }) {
  const t = await getT()
  const card = kind === 'card'
  return (
    <section className="mt-10">
      <h2 className="flex items-center gap-2 text-2xl font-bold text-fg">
        <Coins className="h-5 w-5 text-positive" strokeWidth={1.75} aria-hidden />
        {t('Chtějí koupit ({n})', { n: rows.length })}
      </h2>
      {rows.length === 0 ? (
        <EmptyState className="mt-4">
          {card ? t('Zatím kartu nikdo nepoptává.') : t('Zatím produkt nikdo nepoptává.')}
        </EmptyState>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted">
            {card
              ? t('Máš kartu? Napiš zájemci přes jeho profil nebo kartu nabídni ve své sbírce.')
              : t('Máš produkt? Napiš zájemci přes jeho profil nebo produkt nabídni ve své sbírce.')}
          </p>
          <ul className={`mt-4 divide-y divide-line overflow-hidden ${panel}`}>
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/@${encodeURIComponent(r.user.nickname)}`} className="font-semibold text-fg hover:underline">
                    {r.user.nickname}
                  </Link>{' '}
                  <BadgeIcon nickname={r.user.nickname} />
                  <span className="text-sm text-subtle"> · {r.user.city ?? r.user.region ?? t('neuvedeno')}</span>
                  {r.detail.length > 0 && <p className="text-xs text-subtle">{r.detail.join(' · ')}</p>}
                </div>
                <span className="font-semibold tabular-nums text-positive">
                  {r.maxPriceCzk ? t('koupí do {price} Kč', { price: r.maxPriceCzk.toLocaleString('cs-CZ') }) : t('koupí (cena dohodou)')}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

/** Detail karty: kdo ji chce koupit a za kolik (veřejné — vidí i ti, kdo kartu zatím nenabízejí). */
export async function CardBuyers({ cardId }: { cardId: string }) {
  const wants = await prisma.wantItem.findMany({
    where: { cardId, buy: true, user: visibleUser },
    include: { user: { select: { nickname: true, city: true, region: true } } },
    orderBy: [{ maxPriceCzk: { sort: 'desc', nulls: 'last' } }, { updatedAt: 'desc' }],
    take: 100,
  })
  const t = await getT()
  const rows = wants.map((w) => ({
    id: w.id,
    maxPriceCzk: w.maxPriceCzk,
    user: w.user,
    detail: [
      w.variant && t(VARIANT_LABEL[w.variant]),
      w.minCondition && t('stav min. {cond}', { cond: t(CONDITION_LABEL[w.minCondition]).toLowerCase() }),
      w.language && w.language.toUpperCase(),
    ].filter((x): x is string => !!x),
  }))
  return <BuyersList rows={rows} kind="card" />
}

export async function ProductBuyers({ productId }: { productId: number }) {
  const wants = await prisma.productWant.findMany({
    where: { productId, buy: true, user: visibleUser },
    include: { user: { select: { nickname: true, city: true, region: true } } },
    orderBy: [{ maxPriceCzk: { sort: 'desc', nulls: 'last' } }, { updatedAt: 'desc' }],
    take: 100,
  })
  return <BuyersList rows={wants.map((w) => ({ id: w.id, maxPriceCzk: w.maxPriceCzk, user: w.user, detail: [] }))} kind="product" />
}
