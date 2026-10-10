import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { findCollectors, parsePlace } from '@/lib/matches'
import { COUNTRY_LABEL, REGIONS } from '@/lib/regions'
import { CollectorList } from '@/components/CollectorList'
import { prisma } from '@/lib/prisma'
import { ratingSummary } from '@/lib/ratings'
import { getT } from '@/lib/i18n/server'
import { BadgeIcon } from '@/components/Badges'
import { btnInk, panel } from '@/components/design'
import { ArrowRight, ThumbsDown, ThumbsUp } from 'lucide-react'

const arrowLink = 'inline-flex items-center gap-1 font-semibold text-accent underline-offset-4 hover:underline'

export async function generateMetadata() {
  const t = await getT()
  return { title: t('Najdi sběratele'), robots: { index: false } }
}
export const dynamic = 'force-dynamic'

export default async function CollectorsPage({ searchParams }: { searchParams: Promise<{ kde?: string }> }) {
  const t = await getT()
  const user = await getCurrentUser()
  if (!user) redirect('/prihlaseni?next=/sberatele')
  const { key, place } = parsePlace((await searchParams).kde, user.region)
  const { collectors, total, mine } = await findCollectors(user.id, place)
  const nothingWanted = !mine.wantCards.length && !mine.wantProducts.length
  // Moje kartička „takhle tě vidí ostatní“.
  const [summary, offerCount, buyCount] = await Promise.all([
    ratingSummary(user.id),
    prisma.collectionItem.count({ where: { userId: user.id, spareQty: { gt: 0 }, offerType: { not: null }, hiddenAt: null } }),
    prisma.wantItem.count({ where: { userId: user.id, buy: true } }),
  ])
  const nick = encodeURIComponent(user.nickname)

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-4xl font-extrabold text-fg sm:text-[44px]">{t('Najdi sběratele')}</h1>
      <p className="mt-2 text-muted">
        {t('Lidé, kteří mají nejvíc z toho, co ti chybí. Napřed ti, se kterými jde udělat výměnu oběma směry.')}
      </p>

      <section className={`${panel} mt-6 p-5`}>
        <p className="eyebrow mb-3">{t('Takhle tě vidí ostatní')}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--ink)] font-extrabold text-brand-yellow dark:bg-brand-yellow dark:text-[var(--ink)]">
            {user.nickname.slice(0, 1).toUpperCase()}
          </span>
          <span className="font-bold text-fg">{user.nickname}</span>
          <BadgeIcon nickname={user.nickname} />
          <span className="inline-flex flex-wrap items-center gap-x-1 text-xs tabular-nums text-subtle">
            {[user.city, user.region, t(COUNTRY_LABEL[user.country])].filter(Boolean).join(', ')}
            {summary.total > 0 ? (
              <>
                {' · '}
                <ThumbsUp className="h-3.5 w-3.5 text-positive" strokeWidth={1.75} role="img" aria-label={t('Kladná')} /> {summary.pos} ·{' '}
                <ThumbsDown className="h-3.5 w-3.5 text-danger" strokeWidth={1.75} role="img" aria-label={t('Záporná')} /> {summary.neg}
              </>
            ) : (
              ` · ${t('zatím bez hodnocení')}`
            )}
          </span>
        </div>
        <p className="mt-2 text-sm text-muted">
          {t('Nabízíš {offers} · chybí ti {wanted}', { offers: offerCount, wanted: mine.wantCards.length + mine.wantProducts.length })}
          {buyCount > 0 && ` · ${t('chceš koupit {count}', { count: buyCount })}`}
        </p>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <Link href={`/@${nick}`} className={arrowLink}>
            {t('Můj veřejný profil')}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link href={`/@${nick}/hodnoceni`} className={arrowLink}>
            {t('Moje hodnocení')}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link href={`/@${nick}?ukaz=hledam`} className={arrowLink}>
            {t('Co hledám (sdílet)')}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link href="/ucet#pozvi" className={arrowLink}>
            {t('Pozvi kamaráda')}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
        {!user.region && (
          <p className="mt-2 text-xs text-subtle">
            {t('Tip: doplň si v')}{' '}
            <Link href="/ucet" className="underline">
              {t('Můj účet')}
            </Link>{' '}
            {t('kraj a město, ať tě najdou sběratelé z okolí.')}
          </p>
        )}
      </section>

      <form className="mt-6 flex flex-wrap items-center gap-2 text-sm">
        <label htmlFor="kde" className="font-medium text-fg">
          {t('Kde:')}
        </label>
        <select
          id="kde"
          name="kde"
          defaultValue={key}
          className="min-h-11 rounded-xl border border-line-strong bg-card px-3 py-2 text-fg"
        >
          <option value="vse">{t('Celé Česko a Slovensko')}</option>
          {(['CZ', 'SK'] as const).map((c) => (
            <optgroup key={c} label={t(COUNTRY_LABEL[c])}>
              <option value={c}>{c === 'CZ' ? t('Celé Česko') : t('Celé Slovensko')}</option>
              {REGIONS[c].map((r) => (
                <option key={r} value={`r:${r}`}>
                  {r}
                  {r === user.region ? ` (${t('můj kraj')})` : ''}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <button className={btnInk}>{t('Hledat')}</button>
      </form>

      <div className="mt-8">
        {nothingWanted ? (
          <p className="text-subtle">
            {t('Nejdřív si označ, co ti chybí: otevři')}{' '}
            <Link href="/sady" className="underline">
              {t('sadu')}
            </Link>
            {t(', přepni na „Chybí“ a klepni na karty (nebo použij „Vše, co nemám, mi chybí“).')}
          </p>
        ) : collectors.length ? (
          <>
            <p className="mb-3 text-sm text-subtle">
              {total} {total === 1 ? t('sběratel') : total >= 2 && total <= 4 ? t('sběratelé') : t('sběratelů')}
              {total > collectors.length && ` (${t('zobrazeno prvních {count}', { count: collectors.length })})`}
            </p>
            <CollectorList collectors={collectors} />
          </>
        ) : (
          <p className="text-subtle">
            {t('Tady zatím nikdo nemá nic z toho, co ti chybí.')}{' '}
            {key !== 'vse' && (
              <Link href="/sberatele?kde=vse" className="underline">
                {t('Zkus celé Česko a Slovensko.')}
              </Link>
            )}
          </p>
        )}
      </div>
    </main>
  )
}
