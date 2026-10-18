import Link from 'next/link'
import { UpcomingBanner } from '@/components/UpcomingBanner'
import { Onboarding } from '@/components/Onboarding'
import { JsonLd, SITE } from '@/components/JsonLd'
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
import { cardImage, formatCzk, setLogo, subsetLabels } from '@/lib/format'
import { ensureEurCzk } from '@/lib/fx'
import { ArrowLeftRight, ArrowRight, Camera, Layers } from 'lucide-react'
import { ProgressMeter, SectionHeader, StatCard, btnPrimary, btnSecondary, container, panel, panelInteractive } from '@/components/design'
import { getT, getLocale } from '@/lib/i18n/server'
import { LOCALE_INFO, type TFunc } from '@/lib/i18n/config'

export const dynamic = 'force-dynamic'

const num = (n: number) => n.toLocaleString('cs-CZ')

export default async function Home({ searchParams }: { searchParams: Promise<{ vitej?: string }> }) {
  const { vitej } = await searchParams
  await ensureEurCzk() // kurz ČNB pro ceny v Kč (cenovka v hero)
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

  const labels = subsetLabels(latest)
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
      <JsonLd
        data={[
          {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'pokemon.jede.online',
            alternateName: t('Pokémon karty – sbírka a výměny'),
            url: SITE,
            inLanguage: ['cs', 'sk', 'en'],
            description: t('Bezplatná komunita sběratelů Pokémon karet z Česka a Slovenska: sbírka, chybějící karty, ceny, výměny, tržiště a aukce.'),
          },
          {
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: 'pokemon.jede.online',
            url: SITE,
            logo: `${SITE}/logo-1024.png`,
            email: 'pokemon@jede.online',
            areaServed: ['CZ', 'SK'],
          },
        ]}
      />
      {user && vitej && <Onboarding nickname={user.nickname} />}
      {user ? (
        <UserDashboard user={user} vitej={!!vitej} t={t} />
      ) : (
        <GuestHero t={t} setCount={setCount} cardCount={cardCount} previewSetId={latest[0]?.id} />
      )}

      {!user && (
        <div className="border-b border-line bg-surface">
          <div className={`${container} py-16 sm:py-20`}>
            <WhyUse t={t} />
          </div>
        </div>
      )}

      {user && (
        <div className={`${container} py-12 sm:py-16`}>
          <Matches userId={user.id} region={user.region} t={t} />
        </div>
      )}

      <div className={`${container} ${user ? 'pb-16' : 'py-16'} sm:pb-24 ${user ? '' : 'sm:pt-20'}`}>
        <LatestOffers note={priceNote} />
      </div>

      <section className="border-t border-line bg-surface py-16 sm:py-24">
        <div className={container}>
          <UpcomingBanner className="mb-8" />
          <SectionHeader title={t('Nejnovější sady')} href="/sady" linkLabel={t('Všechny sady')} />
          {latest.length ? (
            <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:gap-4 lg:grid-cols-4">
              {latest.map((s) => (
                <SetTile key={s.id} {...s} progress={progressOf(s.id)} subLabel={labels.get(s.id)} />
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

/** Návštěvník: hero ve stylu „Sběratelské galerie“ — velký nadpis, vějíř nejdražších karet nejnovější sady s cenovkou. */
async function GuestHero({ t, setCount, cardCount, previewSetId }: { t: TFunc; setCount: number; cardCount: number; previewSetId?: string }) {
  // Nejdražší karty nejnovější sady, každá jiná (ne tři varianty téhož Pokémona) — u duplicit zůstane ta dražší.
  const [candidates, previewSet] = previewSetId
    ? await Promise.all([
        prisma.card.findMany({
          where: { setId: previewSetId, imageUrl: { not: null } },
          orderBy: { priceEur: { sort: 'desc', nulls: 'last' } },
          select: { id: true, name: true, imageUrl: true, localId: true, priceEur: true },
          take: 40,
        }),
        prisma.cardSet.findUnique({ where: { id: previewSetId }, select: { id: true, name: true } }),
      ])
    : [[], null]
  const seen = new Set<string>()
  const preview = candidates
    .filter((c) => {
      const key = c.name.replace(/\s+(ex|EX|V|VMAX|VSTAR|GX)$/, '').toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 4)
  const top = preview[0]
  const topPrice = top ? formatCzk(top.priceEur) : null
  // Vějíř: nejdražší karta vpředu (poslední v pořadí kreslení), ostatní za ní.
  const fan = [
    { card: preview[3], cls: 'left-[2%] top-[16%] -rotate-[14deg] z-10' },
    { card: preview[2], cls: 'left-[52%] top-[18%] rotate-[12deg] z-20' },
    { card: preview[1], cls: 'left-[16%] top-[6%] -rotate-[5deg] z-30' },
    { card: preview[0], cls: 'left-[34%] top-[9%] rotate-[6deg] z-40' },
  ].filter((f) => f.card)
  return (
    <section className="relative overflow-hidden border-b border-line">
      {/* Žlutá záře a tenké soustředné kruhy (náznak Pokéballu) vpravo nahoře. */}
      <div aria-hidden className="pointer-events-none absolute -right-40 -top-48 h-[900px] w-[900px] rounded-full bg-[radial-gradient(closest-side,rgba(255,203,5,0.28),rgba(255,203,5,0.08)_45%,transparent_72%)] dark:opacity-50" />
      <div aria-hidden className="pointer-events-none absolute -right-20 -top-28 hidden h-[760px] w-[760px] rounded-full border-[1.5px] border-[rgba(14,27,46,0.07)] lg:block dark:border-[rgba(255,255,255,0.06)]" />
      <div aria-hidden className="pointer-events-none absolute right-10 -top-2 hidden h-[560px] w-[560px] rounded-full border-[1.5px] border-[rgba(14,27,46,0.07)] lg:block dark:border-[rgba(255,255,255,0.06)]" />
      <div className={`${container} relative grid items-center gap-8 pb-14 pt-10 sm:pb-20 sm:pt-16 lg:grid-cols-[1.02fr_1fr] lg:gap-10 lg:pb-24 lg:pt-20`}>
        <div className="hero-rise">
          <p className="eyebrow flex items-center gap-2.5">
            <span aria-hidden className="h-[1.5px] w-6 bg-fg" />
            {t('Komunita sběratelů · Česko a Slovensko')}
          </p>
          <h1 className="mt-5 text-[44px] font-extrabold leading-[0.98] text-fg sm:text-[56px] xl:text-[64px]">
            {t('Tvoje sbírka.')}
            <br />
            <span className="relative inline-block lg:whitespace-nowrap">
              {t('Konečně v pořádku.')}
              <svg aria-hidden viewBox="0 0 300 18" preserveAspectRatio="none" className="absolute -bottom-2 left-0 h-3.5 w-[46%] sm:h-4">
                <path d="M3 12 C 80 2, 190 2, 297 9" fill="none" stroke="#FFCB05" strokeWidth="7" strokeLinecap="round" />
              </svg>
            </span>
          </h1>
          <p className="mt-7 max-w-[520px] text-lg leading-relaxed text-muted sm:text-[19px]">
            {t('Eviduj karty, sleduj, co ti v sadách chybí, hlídej ceny a vyměňuj s lidmi z okolí. Kartu stačí vyfotit.')}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/registrace" className={`${btnPrimary} min-h-[52px] px-6 text-[16.5px]`}>
              {t('Začít sbírat zdarma')}
              <ArrowRight aria-hidden />
            </Link>
            <Link href="/sady" className={`${btnSecondary} min-h-[52px] px-6`}>
              {t('Prohlédnout sady')}
            </Link>
          </div>
          <ul className="mt-10 flex flex-wrap gap-x-7 gap-y-2 font-mono text-[13px] text-muted">
            <li>
              <b className="text-[15px] font-bold text-fg">{num(setCount)}</b>&nbsp; {t('sad')}
            </li>
            <li>
              <b className="text-[15px] font-bold text-fg">{num(cardCount)}</b>&nbsp; {t('karet')}
            </li>
            <li className="flex items-center gap-2">
              <span aria-hidden className="h-[7px] w-[7px] rounded-full bg-positive shadow-[0_0_0_4px_color-mix(in_srgb,var(--positive)_18%,transparent)]" />
              {t('ceny z Cardmarketu denně')}
            </li>
          </ul>
        </div>

        {fan.length >= 3 && (
          <div className="relative mx-auto aspect-[10/9] w-full max-w-[420px] sm:max-w-[560px]" aria-hidden>
            {fan.map(({ card, cls }) => (
              <div
                key={card!.id}
                className={`absolute aspect-[63/88] w-[42%] overflow-hidden rounded-[4.5%/3.2%] bg-surface shadow-[0_2px_2px_rgba(14,27,46,0.1),0_30px_50px_-18px_rgba(14,27,46,0.55)] transition-transform duration-300 hover:-translate-y-2 ${cls}`}
              >
                <CardImg src={cardImage(card!.imageUrl, 'high')} alt={card!.name} eager />
              </div>
            ))}
            {top && topPrice && (
              <div className="absolute -bottom-2 left-0 z-50 hidden max-w-[260px] rounded-xl bg-[color-mix(in_srgb,var(--bg-card)_92%,transparent)] px-3.5 py-2.5 shadow-[0_2px_4px_rgba(14,27,46,0.05),0_8px_24px_-6px_rgba(14,27,46,0.18)] ring-1 ring-line backdrop-blur sm:block">
                <p className="eyebrow truncate !text-[10px]">{t('Nejdražší v sadě {set}', { set: previewSet?.name ?? '' })}</p>
                <p className="mt-0.5 text-sm font-bold text-fg">
                  {top.name} <span className="font-mono text-xs font-medium text-subtle">{top.localId}</span>
                </p>
                <p className="font-display text-xl font-extrabold tabular-nums text-fg">≈ {topPrice}</p>
              </div>
            )}
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
      <div aria-hidden className="pointer-events-none absolute -right-40 -top-56 h-[640px] w-[640px] rounded-full bg-[radial-gradient(closest-side,rgba(255,203,5,0.2),transparent_70%)] dark:opacity-50" />
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
          <div>
            <p className="eyebrow">{t('Tvoje sbírka')}</p>
            <h1 className="mt-2 text-4xl font-extrabold text-fg sm:text-[44px]">{t('Ahoj, {name}', { name: user.nickname })}</h1>
          </div>
          <Link href="/sbirka" className="group inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-accent">
            {t('Moje sbírka')}
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
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
            <h2 className="mb-4 text-xl font-bold text-fg">{t('Rozpracované sady')}</h2>
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

/** Jak to funguje — 3 kroky (jen pro návštěvníky). */
function WhyUse({ t }: { t: TFunc }) {
  const steps = [
    { icon: Camera, title: t('Vyfoť nebo napiš číslo'), text: t('Web kartu pozná, ukáže sadu a cenu. Ty jen potvrdíš „Přidat do alba“.') },
    { icon: Layers, title: t('Uvidíš, co ti chybí'), text: t('Každá sada jako album: co máš, co chybí a kolik zbývá do kompletu.') },
    { icon: ArrowLeftRight, title: t('Vyměň s ostatními'), text: t('Najdi lidi, kteří mají tvoje chybějící karty, a domluvte se v chatu.') },
  ]
  return (
    <section aria-labelledby="how-title">
      <p className="eyebrow">{t('Jak to funguje')}</p>
      <h2 id="how-title" className="mt-3 max-w-[640px] text-3xl font-bold leading-[1.08] text-fg sm:text-[42px]">
        {t('Od hromádky na stole k přehledné sbírce za pár minut.')}
      </h2>
      <ol className="mt-10 grid gap-4 sm:grid-cols-3 sm:gap-5">
        {steps.map((st, n) => (
          <li key={st.title} className={`${panel} p-6 sm:p-7`}>
            <div className="flex items-start justify-between">
              <span className="grid h-12 w-12 place-items-center rounded-[14px] bg-[var(--ink)] text-brand-yellow dark:bg-brand-yellow dark:text-[var(--ink)]">
                <st.icon className="h-[22px] w-[22px]" strokeWidth={1.75} aria-hidden />
              </span>
              <span className="font-mono text-[13px] text-subtle">{String(n + 1).padStart(2, '0')}</span>
            </div>
            <h3 className="mt-5 text-[19px] font-semibold text-fg">{st.title}</h3>
            <p className="mt-2 leading-relaxed text-muted">{st.text}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
