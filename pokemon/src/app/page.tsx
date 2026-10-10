import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { SetTile } from '@/components/SetTile'
import { getCurrentUser } from '@/lib/auth'
import { findCollectorsCached, parsePlace } from '@/lib/matches'
import { CollectorList } from '@/components/CollectorList'
import { LatestOffers } from '@/components/LatestOffers'
import { GettingStarted } from '@/components/GettingStarted'
import { CardImg } from '@/components/CardImg'
import { setProgress } from '@/lib/progress'
import { portfolio } from '@/lib/portfolio'
import { cardImage, setLogo } from '@/lib/format'
import { Pokeball, ProgressMeter, SectionHeader, StatCard, btnPrimary, btnSecondary, container, linkAccent, panel, panelInteractive } from '@/components/design'
import { getT, getLocale } from '@/lib/i18n/server'
import { LOCALE_INFO, type TFunc } from '@/lib/i18n/config'

export const dynamic = 'force-dynamic'

const num = (n: number) => n.toLocaleString('cs-CZ')

export default async function Home({ searchParams }: { searchParams: Promise<{ vitej?: string }> }) {
  const { vitej } = await searchParams
  const t = await getT()
  const intl = LOCALE_INFO[await getLocale()].intl
  const user = await getCurrentUser()
  const [latest, setCount, cardCount, priceAgg] = await Promise.all([
    prisma.cardSet.findMany({
      where: { game: 'pokemon', language: 'en' },
      orderBy: { releaseDate: { sort: 'desc', nulls: 'last' } },
      take: 8,
    }),
    prisma.cardSet.count({ where: { game: 'pokemon' } }),
    prisma.card.count(),
    prisma.card.aggregate({ _max: { priceUpdatedAt: true } }),
  ])

  // Postup přihlášeného v nejnovějších sadách (jen sady, ve kterých něco má).
  const latestProgress = user ? await setProgress(user.id, latest.map((s) => s.id)) : null
  const progressOf = (id: string) => {
    const p = latestProgress?.get(id)
    if (!p) return null
    const pick = p.base ?? p.complete
    return pick.owned > 0 ? pick : null
  }

  const updated = priceAgg._max.priceUpdatedAt
  const priceNote = (
    <>
      {t('Ceny karet z Cardmarketu · aktualizace jednou denně')}
      {updated && (
        <span className="tabular-nums">
          {' '}
          · {t('naposledy {date}', { date: updated.toLocaleString(intl, { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Prague' }) })}
        </span>
      )}
    </>
  )

  return (
    <main>
      {user ? (
        <UserDashboard user={user} vitej={!!vitej} t={t} />
      ) : (
        <GuestHero t={t} setCount={setCount} cardCount={cardCount} previewSetId={latest[0]?.id} />
      )}

      {!user && (
        <div className={`${container} py-14 sm:py-20`}>
          <WhyUse t={t} />
        </div>
      )}

      {user && (
        <div className={`${container} py-12 sm:py-16`}>
          <Matches userId={user.id} region={user.region} t={t} />
        </div>
      )}

      <div className={`${container} pb-16 sm:pb-24`}>
        <LatestOffers note={priceNote} />
      </div>

      <section className="texture-dots border-y border-line bg-surface py-16 sm:py-24">
        <div className={container}>
          <SectionHeader title={t('Nejnovější sady')} href="/sady" linkLabel={t('Všechny sady')} />
          {latest.length ? (
            <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:gap-4 lg:grid-cols-4">
              {latest.map((s) => (
                <SetTile key={s.id} {...s} progress={progressOf(s.id)} />
              ))}
            </div>
          ) : (
            <p className="text-muted">{t('Katalog se právě načítá. Zkus to za pár minut.')}</p>
          )}
        </div>
      </section>
    </main>
  )
}

/** Návštěvník: hero s kartami „v ruce“ (skutečné obrázky z nejnovější sady) a velkým jemným Pokéballem v pozadí. */
async function GuestHero({ t, setCount, cardCount, previewSetId }: { t: TFunc; setCount: number; cardCount: number; previewSetId?: string }) {
  const preview = previewSetId
    ? await prisma.card.findMany({
        where: { setId: previewSetId, imageUrl: { not: null } },
        orderBy: { priceEur: { sort: 'desc', nulls: 'last' } },
        select: { id: true, name: true, imageUrl: true },
        take: 5,
      })
    : []
  // Vějíř karet: mírné natočení a posun, prostřední karta nahoře.
  const fan = [
    'left-[2%] top-[18%] -rotate-[9deg] z-10',
    'left-[20%] top-[8%] -rotate-[4deg] z-20',
    'left-[38%] top-[4%] rotate-[1deg] z-30',
    'left-[56%] top-[9%] rotate-[5deg] z-20',
    'left-[72%] top-[19%] rotate-[10deg] z-10',
  ]
  return (
    <section className="relative overflow-hidden border-b border-line">
      {/* Velký abstraktní Pokéball — patrný až na druhý pohled. */}
      <Pokeball className="pointer-events-none absolute -right-40 top-1/2 h-[420px] w-[420px] -translate-y-1/2 text-brand-blue-dark opacity-[0.045] sm:h-[560px] sm:w-[560px] lg:-right-24 lg:h-[720px] lg:w-[720px] dark:text-white dark:opacity-[0.05]" />
      <div className={`${container} relative grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-[1.05fr_1fr] lg:gap-12 lg:py-24`}>
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-md bg-brand-yellow px-2 py-1 font-extrabold tracking-wider text-brand-blue-deep">BETA</span>
            <span className="font-medium text-muted">{t('Fan project · zdarma · bez reklam')}</span>
          </div>
          <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-blue dark:text-accent">
            <Pokeball className="h-3.5 w-3.5" /> {t('Pokémon TCG fan project')}
          </p>
          <h1 className="mt-4 max-w-2xl text-4xl font-black leading-[1.06] tracking-tight text-brand-blue-deep sm:text-5xl lg:text-[58px] dark:text-white">
            {t('Tvoje Pokémon sbírka.')}
            <br />
            <span className="text-brand-blue dark:text-brand-yellow">{t('Na jednom místě.')}</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
            {t('Eviduj karty, doplňuj sety, sleduj ceny a obchoduj s dalšími sběrateli z Česka a Slovenska.')}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/registrace" className={btnPrimary}>
              {t('Začít sbírat')}
            </Link>
            <Link href="/sady" className={btnSecondary}>
              {t('Procházet karty')}
            </Link>
            <Link href="/trziste" className={`${linkAccent} inline-flex min-h-11 items-center px-1 text-sm font-semibold`}>
              {t('Tržiště')} →
            </Link>
          </div>
          <ul className="mt-8 flex flex-wrap gap-2.5 text-xs font-bold uppercase tracking-wide">
            <li className={`${panel} flex items-center gap-2 px-3.5 py-2`}>
              <span className="text-base tabular-nums text-brand-blue-deep dark:text-white">{num(setCount)}</span>
              <span className="text-muted">{t('sad')}</span>
            </li>
            <li className={`${panel} flex items-center gap-2 px-3.5 py-2`}>
              <span className="text-base tabular-nums text-brand-blue-deep dark:text-white">{num(cardCount)}</span>
              <span className="text-muted">{t('karet')}</span>
            </li>
            <li className={`${panel} flex items-center gap-2 px-3.5 py-2`}>
              <span aria-hidden className="h-2 w-2 rounded-full bg-brand-red" />
              <span className="text-muted">{t('Ceny z Cardmarketu')}</span>
            </li>
          </ul>
        </div>

        {preview.length >= 3 && (
          <div className="relative mx-auto aspect-[5/4] w-full max-w-[340px] sm:max-w-xl" aria-hidden>
            <div className="pointer-events-none absolute inset-[8%] rounded-full bg-[radial-gradient(closest-side,var(--glow),transparent)]" />
            {preview.map((c, i) => (
              <div
                key={c.id}
                className={`absolute aspect-[63/88] w-[28%] overflow-hidden rounded-xl bg-surface shadow-[0_14px_30px_rgba(20,35,60,0.22)] ring-1 ring-black/5 transition-transform duration-200 hover:-translate-y-1.5 ${fan[i + (preview.length === 3 ? 1 : 0)]}`}
              >
                <CardImg src={cardImage(c.imageUrl)} alt={c.name} eager />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

/** Přihlášený: souhrn sbírky (jen hodnoty, které už umíme spočítat) a sady, které právě sbírá. */
async function UserDashboard({
  user,
  vitej,
  t,
}: {
  user: { id: string; nickname: string; emailVerifiedAt: Date | null }
  vitej: boolean
  t: TFunc
}) {
  const [items, wantCount, value] = await Promise.all([
    prisma.collectionItem.findMany({ where: { userId: user.id, quantity: { gt: 0 } }, select: { cardId: true, quantity: true, spareQty: true, card: { select: { setId: true } } } }),
    prisma.wantItem.count({ where: { userId: user.id } }),
    portfolio(user.id),
  ])
  const distinct = new Set(items.map((i) => i.cardId)).size
  const pieces = items.reduce((s, i) => s + i.quantity, 0)
  const spare = items.reduce((s, i) => s + i.spareQty, 0)

  // „Pokračuj ve sbírání“: sady s nejvíc kartami, které ještě nejsou kompletní.
  const perSet = new Map<string, number>()
  for (const i of items) perSet.set(i.card.setId, (perSet.get(i.card.setId) ?? 0) + 1)
  const candidates = [...perSet.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([id]) => id)
  const [progress, sets] = await Promise.all([
    setProgress(user.id, candidates),
    prisma.cardSet.findMany({ where: { id: { in: candidates } }, select: { id: true, name: true, logoUrl: true } }),
  ])
  const collecting = sets
    .map((s) => {
      const p = progress.get(s.id)!
      const pick = p.base ?? p.complete
      return { ...s, owned: pick.owned, total: pick.total }
    })
    .filter((s) => s.total > 0 && s.owned < s.total)
    .sort((a, b) => b.owned / b.total - a.owned / a.total)
    .slice(0, 4)

  return (
    <section className="relative overflow-hidden border-b border-line">
      <Pokeball className="pointer-events-none absolute -right-32 -top-24 h-[420px] w-[420px] text-brand-blue-dark opacity-[0.04] dark:text-white dark:opacity-[0.05]" />
      <div className={`${container} relative py-10 sm:py-14`}>
        {vitej && (
          <p className="mb-6 rounded-panel border border-line bg-[color-mix(in_srgb,var(--positive)_10%,transparent)] p-4 text-sm text-fg">
            {t(
              'Účet je založený! Poslali jsme ti e-mail s odkazem pro potvrzení. Když ho nevidíš, podívej se do složky Spam / Nevyžádaná pošta a označ ho jako „není spam“.',
            )}
          </p>
        )}
        <GettingStarted userId={user.id} nickname={user.nickname} emailVerified={!!user.emailVerifiedAt} />
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-3xl font-black tracking-tight text-fg sm:text-4xl">{t('Ahoj, {name}', { name: user.nickname })}</h1>
          <Link href="/sbirka" className={`${linkAccent} inline-flex min-h-11 items-center text-sm`}>
            {t('Moje sbírka')} →
          </Link>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label={t('Sbírka')} value={num(distinct)} sub={t('{n} kusů celkem', { n: num(pieces) })} tone="positive" />
          <StatCard label={t('Odhadovaná hodnota')} value={`${num(value.valueCzk)} Kč`} sub={`≈ ${value.valueEur.toLocaleString('cs-CZ', { maximumFractionDigits: 0 })} €`} />
          <StatCard label={t('Chybí')} value={num(wantCount)} sub={t('karet na seznamu')} tone="warning" />
          <StatCard label={t('Navíc')} value={num(spare)} sub={t('kusů k výměně')} />
        </div>

        {collecting.length > 0 && (
          <div className="mt-10">
            <h2 className="mb-4 text-xl font-bold tracking-tight text-fg">{t('Rozpracované sady')}</h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {collecting.map((s) => (
                <li key={s.id}>
                  <Link href={`/sady/${encodeURIComponent(s.id)}`} className={`${panelInteractive} block p-4`}>
                    {/* Logo sady místo názvu (název zůstává pro čtečky a jako popisek); bez loga jen název. */}
                    <div className="mb-3 grid h-14 place-items-center" title={s.name}>
                      {setLogo(s.logoUrl) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={setLogo(s.logoUrl)!} alt={s.name} loading="lazy" className="max-h-14 w-auto max-w-full object-contain" />
                      ) : (
                        <p className="truncate font-semibold text-fg">{s.name}</p>
                      )}
                    </div>
                    <ProgressMeter owned={s.owned} total={s.total} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}

/** Přihlášený: kdo má, co mu chybí (napřed jeho kraj, když tam nikdo není, celé ČR/SK). */
async function Matches({ userId, region, t }: { userId: string; region: string | null; t: TFunc }) {
  let matches = await findCollectorsCached(userId, parsePlace(undefined, region).place, 3)
  if (!matches.collectors.length && region) matches = await findCollectorsCached(userId, {}, 3)
  return (
    <section>
      <SectionHeader title={t('Kdo má, co ti chybí')} href="/sberatele" linkLabel={t('Najdi sběratele')} />
      {matches.collectors.length ? (
        <CollectorList collectors={matches.collectors} />
      ) : (
        <p className={`${panel} p-5 text-sm text-muted`}>
          {matches.mine.wantCards.length || matches.mine.wantProducts.length
            ? t('Zatím nikdo nemá nic z toho, co ti chybí. Mrkni sem později.')
            : t('Označ si v sadě karty, které ti chybí, a tady uvidíš, kdo je má.')}
        </p>
      )}
    </section>
  )
}

/** Krátké „proč to používat“ (jen pro návštěvníky). */
function WhyUse({ t }: { t: TFunc }) {
  const items = [
    {
      title: t('Spravuj svoji sbírku'),
      text: t('Víš přesně, co máš a co ti ještě chybí.'),
      icon: <path d="M4 5h16v14H4zM4 9h16M9 9v10" />,
    },
    {
      title: t('Sleduj ceny'),
      text: t('Ceny karet z Cardmarketu, aktualizované jednou denně.'),
      icon: <path d="M4 19V5M4 19h16M8 15l4-4 3 3 5-6" />,
    },
    {
      title: t('Obchoduj s komunitou'),
      text: t('Prodávej a vyměňuj karty s dalšími sběrateli z Česka a Slovenska.'),
      icon: <path d="M7 7h11l-3-3M17 17H6l3 3" />,
    },
  ]
  return (
    <section aria-label={t('Proč pokemon.jede.online')} className="grid gap-4 sm:grid-cols-3">
      {items.map((i) => (
        <div key={i.title} className={`${panelInteractive} flex gap-4 p-6`}>
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-blue text-white">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              {i.icon}
            </svg>
          </span>
          <div>
            <h3 className="font-semibold text-fg">{i.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted">{i.text}</p>
          </div>
        </div>
      ))}
    </section>
  )
}
