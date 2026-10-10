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
import { cardImage } from '@/lib/format'
import { ProgressMeter, SectionHeader, StatCard, btnPrimary, btnSecondary, container, linkAccent, panel, panelInteractive } from '@/components/design'
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

      <div className={`${container} space-y-16 pb-8 sm:space-y-20`}>
        {!user && <WhyUse t={t} />}

        {user && <Matches userId={user.id} region={user.region} t={t} />}

        <LatestOffers note={priceNote} />

        <section>
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
        </section>
      </div>
    </main>
  )
}

/** Návštěvník: dvousloupcový hero s náhledem „alba“ z obrázků karet nejnovější sady. */
async function GuestHero({ t, setCount, cardCount, previewSetId }: { t: TFunc; setCount: number; cardCount: number; previewSetId?: string }) {
  const preview = previewSetId
    ? await prisma.card.findMany({
        where: { setId: previewSetId, imageUrl: { not: null } },
        orderBy: { priceEur: { sort: 'desc', nulls: 'last' } },
        select: { id: true, name: true, imageUrl: true },
        take: 4,
      })
    : []
  return (
    <section className="border-b border-line">
      <div className={`${container} grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:py-24`}>
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-md bg-accent-soft px-2 py-1 font-bold tracking-wider text-accent">BETA</span>
            <span className="text-muted">{t('Komunitní projekt · zdarma a bez reklam')}</span>
          </div>
          <p className="mt-6 text-sm font-semibold uppercase tracking-wider text-subtle">{t('Správce sbírky Pokémon TCG')}</p>
          <h1 className="mt-3 max-w-2xl text-4xl font-black leading-[1.08] tracking-tight text-fg sm:text-5xl lg:text-[56px]">
            {t('Měj přehled o své sbírce a najdi karty, které ti chybí.')}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
            {t('Katalog všech anglických sad od roku 1999, vlastní sbírka, seznam chybějících karet a výměny se sběrateli z Česka a Slovenska.')}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/registrace" className={btnPrimary}>
              {t('Založit účet zdarma')}
            </Link>
            <Link href="/trziste" className={btnSecondary}>
              {t('Prohlédnout tržiště')}
            </Link>
            <Link href="/hodnoceni" className={`${linkAccent} inline-flex min-h-11 items-center px-1 text-sm`}>
              {t('Nejlépe hodnocení sběratelé')} →
            </Link>
          </div>
          <p className="mt-3 text-sm text-subtle">{t('Prohlížet nabídky a hodnocení můžeš i bez registrace.')}</p>
          <dl className="mt-8 flex gap-3">
            {[
              [t('sad'), setCount],
              [t('karet'), cardCount],
            ].map(([label, value]) => (
              <div key={label} className={`${panel} px-4 py-3`}>
                <dd className="text-xl font-bold tabular-nums text-fg">{num(value as number)}</dd>
                <dt className="text-xs text-muted">{label}</dt>
              </div>
            ))}
          </dl>
        </div>

        {preview.length >= 3 && (
          <div className="relative hidden sm:block" aria-hidden>
            <div className="pointer-events-none absolute inset-0 -z-0 rounded-[24px] bg-[radial-gradient(closest-side,var(--glow),transparent)]" />
            <div className={`${panel} relative mx-auto max-w-md p-5`}>
              <div className="mb-4 flex items-center justify-between text-xs text-muted">
                <span className="font-semibold text-fg">{t('Ukázka alba')}</span>
                <span className="tabular-nums">3 / 4</span>
              </div>
              <div className="grid grid-cols-4 gap-2.5">
                {preview.map((c, i) => (
                  <div
                    key={c.id}
                    className={`aspect-[63/88] overflow-hidden rounded-md bg-surface transition duration-200 hover:-translate-y-0.5 ${i === preview.length - 1 ? 'opacity-35 grayscale' : ''}`}
                  >
                    <CardImg src={cardImage(c.imageUrl)} alt={c.name} />
                  </div>
                ))}
              </div>
              <div className="mt-4 space-y-3">
                <ProgressMeter owned={83} total={128} label="Base" />
                <div className="flex gap-2 text-[11px] font-semibold">
                  <span className="rounded-md bg-[color-mix(in_srgb,var(--positive)_14%,transparent)] px-2 py-1 text-positive">✓ {t('Mám')}</span>
                  <span className="rounded-md bg-[color-mix(in_srgb,var(--warning)_16%,transparent)] px-2 py-1 text-warning">● {t('Chybí')}</span>
                  <span className="rounded-md bg-accent-soft px-2 py-1 text-accent">⇄ {t('Navíc')}</span>
                </div>
              </div>
            </div>
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
    prisma.cardSet.findMany({ where: { id: { in: candidates } }, select: { id: true, name: true } }),
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
    <section className="border-b border-line">
      <div className={`${container} py-10 sm:py-14`}>
        {vitej && (
          <p className="mb-6 rounded-panel border border-line bg-[color-mix(in_srgb,var(--positive)_10%,transparent)] p-4 text-sm text-fg">
            {t(
              'Účet je založený! Poslali jsme ti e-mail s odkazem pro potvrzení. Když ho nevidíš, podívej se do složky Spam / Nevyžádaná pošta a označ ho jako „není spam“.',
            )}
          </p>
        )}
        <GettingStarted userId={user.id} nickname={user.nickname} emailVerified={!!user.emailVerifiedAt} />
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-3xl font-black tracking-tight text-fg sm:text-4xl">{t('Vítej zpět, {name}', { name: user.nickname })}</h1>
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
            <h2 className="mb-4 text-xl font-bold tracking-tight text-fg">{t('Pokračuj ve sbírání')}</h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {collecting.map((s) => (
                <li key={s.id}>
                  <Link href={`/sady/${encodeURIComponent(s.id)}`} className={`${panelInteractive} block p-4`}>
                    <p className="mb-3 truncate font-semibold text-fg" title={s.name}>
                      {s.name}
                    </p>
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
      title: t('Přehled o sbírce'),
      text: t('Víš přesně, co máš a co ti ještě chybí.'),
      icon: <path d="M4 5h16v14H4zM4 9h16M9 9v10" />,
    },
    {
      title: t('Ceny z trhu'),
      text: t('Ceny karet z Cardmarketu, aktualizované jednou denně.'),
      icon: <path d="M4 19V5M4 19h16M8 15l4-4 3 3 5-6" />,
    },
    {
      title: t('Výměny se sběrateli'),
      text: t('Najdi sběratele z Česka a Slovenska.'),
      icon: <path d="M7 7h11l-3-3M17 17H6l3 3" />,
    },
  ]
  return (
    <section aria-label={t('Proč pokemon.jede.online')} className="grid gap-3 pt-12 sm:grid-cols-3 sm:gap-4 sm:pt-16">
      {items.map((i) => (
        <div key={i.title} className={`${panel} flex gap-4 p-5`}>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
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
