import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { CONDITION_LABEL, VARIANT_LABEL } from '@/lib/labels'
import { getT } from '@/lib/i18n/server'
import { BadgeIcon } from '@/components/Badges'

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
      <h2 className="text-xl font-bold">💰 {t('Chtějí koupit ({n})', { n: rows.length })}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed border-slate-300 p-6 text-center text-slate-500 dark:border-slate-700">
          {card ? t('Zatím kartu nikdo nepoptává.') : t('Zatím produkt nikdo nepoptává.')}
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-slate-500">
            {card
              ? t('Máš kartu? Napiš zájemci přes jeho profil nebo kartu nabídni ve své sbírce.')
              : t('Máš produkt? Napiš zájemci přes jeho profil nebo produkt nabídni ve své sbírce.')}
          </p>
          <ul className="mt-3 divide-y divide-slate-200 overflow-hidden rounded-2xl border border-emerald-200 bg-white dark:divide-slate-800 dark:border-emerald-500/30 dark:bg-slate-900">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/u/${encodeURIComponent(r.user.nickname)}`} className="font-semibold hover:underline">
                    {r.user.nickname}
                  </Link>{' '}
                  <BadgeIcon nickname={r.user.nickname} />
                  <span className="text-sm text-slate-500"> · {r.user.city ?? r.user.region ?? t('neuvedeno')}</span>
                  {r.detail.length > 0 && <p className="text-xs text-slate-500">{r.detail.join(' · ')}</p>}
                </div>
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">
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
