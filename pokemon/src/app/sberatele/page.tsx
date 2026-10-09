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
      <h1 className="text-3xl font-black tracking-tight">{t('Najdi sběratele')}</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-300">
        {t('Lidé, kteří mají nejvíc z toho, co ti chybí. Napřed ti, se kterými jde udělat výměnu oběma směry.')}
      </p>

      <section className="mt-6 rounded-2xl border-2 border-dashed border-yellow-400 bg-yellow-50/60 p-4 dark:bg-yellow-400/5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-yellow-800 dark:text-yellow-300">{t('Takhle tě vidí ostatní')}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-yellow-400 font-black text-slate-900">
            {user.nickname.slice(0, 1).toUpperCase()}
          </span>
          <span className="font-bold">{user.nickname}</span>
          <BadgeIcon nickname={user.nickname} />
          <span className="text-xs text-slate-500">
            {[user.city, user.region, t(COUNTRY_LABEL[user.country])].filter(Boolean).join(', ')}
            {summary.total > 0 ? ` · 👍 ${summary.pos} · 👎 ${summary.neg}` : ` · ${t('zatím bez hodnocení')}`}
          </span>
        </div>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {t('Nabízíš {offers} · chybí ti {wanted}', { offers: offerCount, wanted: mine.wantCards.length + mine.wantProducts.length })}
          {buyCount > 0 && ` · ${t('chceš koupit {count}', { count: buyCount })}`}
        </p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium">
          <Link href={`/u/${nick}`} className="text-yellow-700 hover:underline dark:text-yellow-400">
            {t('Můj veřejný profil →')}
          </Link>
          <Link href={`/u/${nick}/hodnoceni`} className="text-yellow-700 hover:underline dark:text-yellow-400">
            {t('Moje hodnocení →')}
          </Link>
          <Link href={`/u/${nick}/chybi`} className="text-yellow-700 hover:underline dark:text-yellow-400">
            {t('Co hledám (sdílet) →')}
          </Link>
          <Link href="/ucet#pozvi" className="text-yellow-700 hover:underline dark:text-yellow-400">
            {t('Pozvi kamaráda →')}
          </Link>
        </div>
        {!user.region && (
          <p className="mt-2 text-xs text-slate-500">
            {t('Tip: doplň si v')}{' '}
            <Link href="/ucet" className="underline">
              {t('Můj účet')}
            </Link>{' '}
            {t('kraj a město, ať tě najdou sběratelé z okolí.')}
          </p>
        )}
      </section>

      <form className="mt-6 flex flex-wrap items-center gap-2 text-sm">
        <label htmlFor="kde" className="font-medium">
          {t('Kde:')}
        </label>
        <select
          id="kde"
          name="kde"
          defaultValue={key}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 dark:border-slate-700 dark:bg-slate-900"
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
        <button className="rounded-full bg-slate-900 px-4 py-1.5 font-semibold text-white dark:bg-yellow-400 dark:text-slate-900">
          {t('Hledat')}
        </button>
      </form>

      <div className="mt-8">
        {nothingWanted ? (
          <p className="text-slate-500">
            {t('Nejdřív si označ, co ti chybí: otevři')}{' '}
            <Link href="/sady" className="underline">
              {t('sadu')}
            </Link>
            {t(', přepni na „Chybí“ a klepni na karty (nebo použij „Vše, co nemám, mi chybí“).')}
          </p>
        ) : collectors.length ? (
          <>
            <p className="mb-3 text-sm text-slate-500">
              {total} {total === 1 ? t('sběratel') : total >= 2 && total <= 4 ? t('sběratelé') : t('sběratelů')}
              {total > collectors.length && ` (${t('zobrazeno prvních {count}', { count: collectors.length })})`}
            </p>
            <CollectorList collectors={collectors} />
          </>
        ) : (
          <p className="text-slate-500">
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
