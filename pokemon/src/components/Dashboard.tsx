import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { portfolio, saveSnapshot } from '@/lib/portfolio'
import { cardImage } from '@/lib/format'
import { CardImg } from '@/components/CardImg'
import { getT, getLocale } from '@/lib/i18n/server'
import { LOCALE_INFO, type TFunc } from '@/lib/i18n/config'

const kc = (n: number) => `${n.toLocaleString('cs-CZ')} Kč`
const box = 'rounded-panel border border-line bg-card p-4'

/** Graf vývoje hodnoty (jednoduchá čára v SVG, bez knihoven). */
function ValueChart({ points, t, intl }: { points: { day: Date; valueCzk: number }[]; t: TFunc; intl: string }) {
  if (points.length < 2)
    return <p className="text-sm text-subtle">{t('Graf se začne plnit — hodnotu ukládáme jednou denně. Za pár dní tu uvidíš vývoj.')}</p>
  const W = 600
  const H = 140
  const vals = points.map((p) => p.valueCzk)
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const span = Math.max(max - min, 1)
  const x = (i: number) => (i / (points.length - 1)) * (W - 8) + 4
  const y = (v: number) => H - 8 - ((v - min) / span) * (H - 24)
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.valueCzk).toFixed(1)}`).join(' ')
  const up = vals[vals.length - 1] >= vals[0]
  const fmt = (dt: Date) => dt.toLocaleDateString(intl, { timeZone: 'UTC', day: 'numeric', month: 'numeric' })
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-36 w-full" role="img" aria-label={t('Vývoj hodnoty sbírky')}>
        <path d={`${d} L${x(points.length - 1)},${H} L${x(0)},${H} Z`} className={up ? 'fill-green-500/10' : 'fill-red-500/10'} />
        <path d={d} fill="none" strokeWidth="2.5" className={up ? 'stroke-green-500' : 'stroke-red-500'} />
      </svg>
      <div className="flex justify-between text-xs text-subtle">
        <span>
          {fmt(points[0].day)}: {kc(points[0].valueCzk)}
        </span>
        <span>
          {fmt(points[points.length - 1].day)}: {kc(points[points.length - 1].valueCzk)}
        </span>
      </div>
    </div>
  )
}

/** Přehled nahoře v „Moje sbírka“: hodnota, investice, vývoj, nejcennější karty, sady a poslední aktivita. */
export async function Dashboard({ userId }: { userId: string }) {
  const t = await getT()
  const intl = LOCALE_INFO[await getLocale()].intl
  const p = await portfolio(userId)
  // Dnešní snímek (graf se tak začne plnit hned od prvního otevření).
  await saveSnapshot(userId, p.valueCzk, p.investedCzk)
  const [history, recent, trades, ratings, waiting] = await Promise.all([
    prisma.valueSnapshot.findMany({
      where: { userId, day: { gte: new Date(Date.now() - 180 * 86_400_000) } },
      orderBy: { day: 'asc' },
    }),
    prisma.collectionItem.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: { id: true, createdAt: true, card: { select: { id: true, name: true, imageUrl: true, set: { select: { name: true } } } } },
    }),
    prisma.tradeRequest.findMany({
      where: { status: 'COMPLETED', OR: [{ fromId: userId }, { toId: userId }] },
      orderBy: { createdAt: 'desc' },
      take: 3,
      include: { from: { select: { nickname: true } }, to: { select: { nickname: true } }, _count: { select: { items: true } } },
    }),
    prisma.rating.findMany({
      where: { toId: userId, hiddenAt: null, from: { bannedAt: null } },
      orderBy: { updatedAt: 'desc' },
      take: 3,
      include: { from: { select: { nickname: true } } },
    }),
    prisma.tradeRequest.count({ where: { toId: userId, status: 'PENDING' } }),
  ])
  const profit = p.investedCzk ? p.investedValueCzk - p.investedCzk : null
  const monthAgo = history.find((h) => h.day.getTime() >= Date.now() - 31 * 86_400_000)
  const change = monthAgo && history.length > 1 ? p.valueCzk - monthAgo.valueCzk : null

  return (
    <section className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className={`${box} border-line-strong bg-accent-soft `}>
          <p className="text-xs text-muted">{t('Hodnota sbírky')}</p>
          <p className="text-3xl font-black">{kc(p.valueCzk)}</p>
          <p className="text-xs text-subtle">
            ≈ {p.valueEur.toLocaleString('cs-CZ', { maximumFractionDigits: 0 })} €
            {p.productsCzk > 0 && ` · ${t('z toho produkty {price}', { price: kc(p.productsCzk) })}`}
            {change !== null && (
              <span className={change >= 0 ? ' text-green-700 dark:text-green-400' : ' text-red-600'}>
                {' '}
                · {change >= 0 ? '+' : ''}
                {kc(change)} {t('za měsíc')}
              </span>
            )}
          </p>
        </div>
        <div className={box}>
          <p className="text-xs text-subtle">{t('Investováno')}</p>
          {p.investedCzk ? (
            <>
              <p className="text-3xl font-black">{kc(p.investedCzk)}</p>
              <p className={`text-xs font-semibold ${profit! >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-600'}`}>
                {profit! >= 0 ? t('Zisk') : t('Ztráta')} {profit! >= 0 ? '+' : ''}
                {kc(profit!)} ({t('dnes mají hodnotu {price}', { price: kc(p.investedValueCzk) })})
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-subtle">
              {t('U karty nebo produktu vyplň „Koupeno za“ a uvidíš, kolik jsi investoval(a) a jaký máš zisk.')}
            </p>
          )}
        </div>
        <div className={box}>
          <p className="text-xs text-subtle">{t('Výměny')}</p>
          <p className="text-3xl font-black">{waiting}</p>
          <p className="text-xs text-subtle">
            {waiting ? (
              <Link href="/poptavky" className="font-semibold text-red-600 underline">
                {t('čeká na tvou odpověď →')}
              </Link>
            ) : (
              t('nic nečeká na odpověď')
            )}
          </p>
        </div>
      </div>

      <div className={box}>
        <h2 className="mb-2 font-bold">{t('Vývoj hodnoty')}</h2>
        <ValueChart points={history} t={t} intl={intl} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={box}>
          <h2 className="mb-3 font-bold">{t('Nejcennější karty')}</h2>
          {p.topCards.length ? (
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-6 lg:grid-cols-3">
              {p.topCards.map((c) => (
                <li key={c.id}>
                  <Link href={`/karta/${encodeURIComponent(c.id)}`} className="block">
                    <div className="aspect-[63/88] overflow-hidden rounded-lg bg-surface shadow-sm">
                      <CardImg src={cardImage(c.imageUrl)} alt={c.name} />
                    </div>
                    <p className="mt-1 truncate text-xs font-medium">{c.name}</p>
                    <p className="text-xs font-semibold text-green-700 dark:text-green-400">
                      {kc(c.unitCzk)}
                      {c.qty > 1 && ` · ${c.qty}×`}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-subtle">{t('Zatím žádné karty s cenou.')}</p>
          )}
        </div>
        <div className={box}>
          <h2 className="mb-3 font-bold">{t('Hodnota po sadách')}</h2>
          {p.bySet.length ? (
            <ul className="space-y-2 text-sm">
              {p.bySet.map((s) => (
                <li key={s.id}>
                  <div className="flex justify-between gap-3">
                    <Link href={`/sady/${encodeURIComponent(s.id)}`} className="truncate hover:underline">
                      {s.name}
                    </Link>
                    <span className="shrink-0 font-semibold">{kc(s.czk)}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface">
                    <div className="h-full rounded-full bg-accent-strong" style={{ width: `${(s.czk / Math.max(p.bySet[0].czk, 1)) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-subtle">{t('Zatím nic.')}</p>
          )}
        </div>
      </div>

      <div className={box}>
        <h2 className="mb-3 font-bold">{t('Poslední aktivita')}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">{t('Naposledy přidané')}</p>
            {recent.length ? (
              <ul className="space-y-1 text-sm">
                {recent.map((r) => (
                  <li key={r.id} className="flex justify-between gap-2">
                    <Link href={`/karta/${encodeURIComponent(r.card.id)}`} className="truncate hover:underline">
                      {r.card.name} <span className="text-subtle">· {r.card.set.name}</span>
                    </Link>
                    <span className="shrink-0 text-xs text-subtle">{r.createdAt.toLocaleDateString(intl)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-subtle">{t('Zatím nic.')}</p>
            )}
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">{t('Dokončené výměny')}</p>
            {trades.length ? (
              <ul className="space-y-1 text-sm">
                {trades.map((tr) => (
                  <li key={tr.id}>
                    <Link href={`/poptavky/${tr.id}`} className="hover:underline">
                      {t('s {name}', { name: tr.fromId === userId ? tr.to.nickname : tr.from.nickname })}
                    </Link>{' '}
                    <span className="text-xs text-subtle">
                      · {tr._count.items} {tr._count.items === 1 ? t('položka') : tr._count.items <= 4 ? t('položky') : t('položek')}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-subtle">{t('Zatím žádné.')}</p>
            )}
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">{t('Nová hodnocení')}</p>
            {ratings.length ? (
              <ul className="space-y-1 text-sm">
                {ratings.map((r) => (
                  <li key={r.id} className="truncate">
                    {r.positive ? '👍' : '👎'} {r.from.nickname}
                    {r.comment && <span className="text-subtle"> · „{r.comment}“</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-subtle">{t('Zatím žádná.')}</p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
