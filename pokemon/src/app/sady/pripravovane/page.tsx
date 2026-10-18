import Link from 'next/link'
import { Bell, BellRing, CalendarClock, ChevronRight, ExternalLink } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { daysUntil, upcomingSets } from '@/lib/upcoming'
import { toggleUpcomingWatch } from '@/app/actions/upcoming'
import { CardImg } from '@/components/CardImg'
import { EmptyState, btnPrimary, btnSecondary, panel } from '@/components/design'
import { cardImage, formatCzk, setLogo } from '@/lib/format'
import { ensureEurCzk } from '@/lib/fx'
import { getT, getLocale } from '@/lib/i18n/server'
import { LOCALE_INFO } from '@/lib/i18n/config'

export async function generateMetadata() {
  const t = await getT()
  return {
    title: t('Připravované sady Pokémon karet'),
    description: t('Nové anglické sady Pokémon TCG, které brzy vyjdou: datum vydání, počet karet a nejžádanější karty podle japonské verze.'),
    alternates: { canonical: '/sady/pripravovane' },
  }
}
export const dynamic = 'force-dynamic'

export default async function UpcomingPage() {
  await ensureEurCzk()
  const [t, locale, user] = await Promise.all([getT(), getLocale(), getCurrentUser()])
  const sets = await upcomingSets(user?.id)
  const jaIds = sets.map((s) => s.jaSetId).filter((x): x is string => !!x)
  const [jaSets, chase] = await Promise.all([
    prisma.cardSet.findMany({ where: { id: { in: jaIds } }, select: { id: true, name: true, logoUrl: true } }),
    Promise.all(
      jaIds.map((id) =>
        prisma.card.findMany({
          where: { setId: id, imageUrl: { not: null } },
          orderBy: { priceEur: { sort: 'desc', nulls: 'last' } },
          select: { id: true, name: true, localId: true, imageUrl: true, priceEur: true },
          take: 8,
        }),
      ),
    ),
  ])
  const chaseBySet = new Map(jaIds.map((id, i) => [id, chase[i]]))
  const jaById = new Map(jaSets.map((s) => [s.id, s]))
  const fmt = (d: Date) => d.toLocaleDateString(LOCALE_INFO[locale].intl, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Prague' })

  return (
    <main className="mx-auto max-w-page px-4 pb-10 pt-6 sm:px-6">
      <nav aria-label={t('Drobečková navigace')} className="flex items-center gap-1.5 text-sm text-subtle">
        <Link href="/sady" className="text-muted hover:text-fg">
          {t('Sady')}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        <span className="text-fg">{t('Připravované')}</span>
      </nav>
      <p className="eyebrow mt-6">{t('Katalog')}</p>
      <h1 className="mt-2 text-4xl font-extrabold text-fg sm:text-[44px]">{t('Připravované sady')}</h1>
      <p className="mt-3 max-w-2xl text-muted">
        {t('Anglické sady, které brzy vyjdou. Ukázka karet a ceny jsou z japonské verze — anglická má obvykle stejné karty. Klikni na „Upozornit mě“ a dáme ti vědět, jakmile bude sada na webu.')}
      </p>

      {!sets.length && (
        <EmptyState className="mt-8">
          <p>{t('Zatím nevíme o žádné připravované sadě. Nové se tu objeví samy.')}</p>
        </EmptyState>
      )}

      <div className="mt-8 space-y-8">
        {sets.map((s) => {
          const days = daysUntil(s.releaseDate)
          const ja = s.jaSetId ? jaById.get(s.jaSetId) : null
          const cards = s.jaSetId ? (chaseBySet.get(s.jaSetId) ?? []) : []
          const watching = !!(s.subs && s.subs.length)
          return (
            <section key={s.id} className={`${panel} relative overflow-hidden p-6 sm:p-8`}>
              <div aria-hidden className="pointer-events-none absolute -right-32 -top-36 h-[420px] w-[420px] rounded-full bg-[radial-gradient(closest-side,rgba(255,203,5,0.25),transparent_70%)] dark:opacity-50" />
              <div className="relative flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <p className="eyebrow">{[s.code, s.cardCount && t('{n} karet', { n: s.cardCount })].filter(Boolean).join(' · ')}</p>
                  <h2 className="mt-2 text-3xl font-extrabold text-fg sm:text-[40px] sm:leading-[1.05]">{s.name}</h2>
                  <p className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#fff6d6] px-3 py-1.5 text-sm font-semibold text-[#7a5600] ring-1 ring-inset ring-[#f5e19a] dark:bg-[rgba(255,203,5,0.12)] dark:text-[#ffd95c] dark:ring-[rgba(255,203,5,0.3)]">
                    <CalendarClock className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                    {days > 1 ? t('vychází za {n} dní · {date}', { n: days, date: fmt(s.releaseDate) }) : days === 1 ? t('vychází zítra · {date}', { date: fmt(s.releaseDate) }) : days === 0 ? t('vychází dnes') : t('vyšla {date} · brzy v katalogu', { date: fmt(s.releaseDate) })}
                  </p>
                  {ja && (
                    <p className="mt-3 text-sm text-muted">
                      {t('Japonská předloha:')}{' '}
                      <Link href={`/sady/${encodeURIComponent(ja.id)}`} className="font-semibold text-accent hover:underline">
                        {ja.name}
                      </Link>
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-start gap-2 md:items-end">
                  {user ? (
                    <form action={toggleUpcomingWatch}>
                      <input type="hidden" name="id" value={s.id} />
                      <button className={watching ? btnSecondary : btnPrimary}>
                        {watching ? <BellRing aria-hidden /> : <Bell aria-hidden />}
                        {watching ? t('Upozorníme tě') : t('Upozornit mě')}
                      </button>
                    </form>
                  ) : (
                    <Link href="/prihlaseni?next=/sady/pripravovane" className={btnPrimary}>
                      <Bell aria-hidden />
                      {t('Upozornit mě')}
                    </Link>
                  )}
                  {s._count.subs > 0 && <p className="text-xs text-subtle">{t('Čeká {n} sběratelů', { n: s._count.subs })}</p>}
                </div>
              </div>

              {cards.length > 0 && (
                <div className="relative mt-8">
                  <p className="eyebrow">{t('Nejžádanější karty (podle japonské verze)')}</p>
                  <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4 lg:grid-cols-8">
                    {cards.map((c) => (
                      <li key={c.id}>
                        <Link href={`/karta/${encodeURIComponent(c.id)}`} className="card-tile group block">
                          <div className="card-frame aspect-[63/88]">
                            <CardImg src={cardImage(c.imageUrl)} alt={c.name} />
                          </div>
                          <p className="mt-2 truncate text-[13.5px] font-semibold text-fg">{c.name}</p>
                          {formatCzk(c.priceEur) && <p className="text-xs tabular-nums text-muted">≈ {formatCzk(c.priceEur)}</p>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="relative mt-6 flex items-center gap-1 text-xs text-subtle">
                {t('Datum a počet karet: ')}
                <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-0.5 underline underline-offset-2 hover:text-fg">
                  TCG Watchtower
                  <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              </p>
            </section>
          )
        })}
      </div>
    </main>
  )
}
