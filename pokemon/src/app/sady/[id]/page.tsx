import type { Metadata } from 'next'
import Link from 'next/link'
import { JsonLd, breadcrumbs } from '@/components/JsonLd'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { safeDecode } from '@/lib/validation'
import { getCurrentUser } from '@/lib/auth'
import { setGoals, setProgress } from '@/lib/progress'
import { defaultGoal, GOAL_MISSING, pickGoal, type Goal } from '@/lib/goal'
import { GoalPicker } from '@/components/GoalPicker'
import { ProgressBars } from '@/components/ProgressBars'
import { byLocalId, cardImage, formatCzk, formatEur, setLogo } from '@/lib/format'
import { ChevronRight, ImageOff, Layers, Package } from 'lucide-react'
import { panel } from '@/components/design'
import { PriceNote } from '@/components/PriceNote'
import { SetGrid } from '@/components/SetGrid'
import { ShareSet } from '@/components/ShareSet'
import { cardVariants } from '@/lib/variants'
import { ProductTile } from '@/components/ProductTile'
import { CardBack } from '@/components/CardBack'
import type { QuickState } from '@/app/actions/collection'
import { ensureEurCzk } from '@/lib/fx'
import { getT, getLocale } from '@/lib/i18n/server'
import { LOCALE_INFO } from '@/lib/i18n/config'
import { setDisplayName } from '@/lib/format'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }>; searchParams?: Promise<{ tab?: string; rezim?: string; start?: string }> }

async function getSet(id: string) {
  return prisma.cardSet.findUnique({
    where: { id: (safeDecode(id) ?? '') },
    include: {
      cards: {
        select: {
          id: true,
          localId: true,
          name: true,
          imageUrl: true,
          priceEur: true,
          types: true,
          hasNormal: true,
          hasHolo: true,
          hasReverse: true,
          hasFirstEd: true,
          hasPokeball: true,
          hasMasterball: true,
        },
      },
    },
  })
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const set = await getSet((await params).id)
  const t = await getT()
  if (!set) return { title: t('Sada nenalezena') }
  const title = t('{name} – seznam karet a ceny', { name: setDisplayName(set) })
  const description = t('Všech {n} karet sady {name} s cenami. Odklikej si, co máš, co ti chybí, a najdi sběratele na výměnu. Zdarma.', {
    n: set.cardCount,
    name: setDisplayName(set),
  })
  return { title, description, alternates: { canonical: `/sady/${encodeURIComponent(set.id)}` }, openGraph: { title, description } }
}

export default async function SetPage({ params, searchParams }: Props) {
  await ensureEurCzk() // kurz ČNB pro korunové částky u cen
  const t = await getT()
  const locale = await getLocale()
  const [set, user] = await Promise.all([getSet((await params).id), getCurrentUser()])
  if (!set) notFound()
  // Postup přihlášeného (base / complete / master); po změně v mřížce se obnoví při dalším načtení stránky.
  const [progress, goals] = user
    ? await Promise.all([setProgress(user.id, [set.id]).then((m) => m.get(set.id) ?? null), setGoals(user.id, [set.id])])
    : [null, null]
  // Co u sady sbírám (base / complete / master) — hlavní číslo, „chybí“ i sdílený obrázek se počítají podle toho.
  const goal: Goal = progress ? (goals?.get(set.id) ?? defaultGoal(progress)) : 'base'
  const picked = progress ? pickGoal(progress, goal) : null
  const sp = await searchParams
  const tab = sp?.tab === 'produkty' ? 'produkty' : 'karty'
  // Z průvodce „Jakou sadu sbíráš?“: rovnou režim Mám a jednorázový tip.
  const initialMode = user && sp?.rezim === 'mam' ? 'owned' : 'view'
  const showTip = !!user && sp?.start === '1'
  const products = await prisma.product.findMany({
    where: { setId: set.id },
    include: { set: { select: { logoUrl: true } } },
    orderBy: [{ imageUrl: { sort: 'asc', nulls: 'last' } }, { name: 'asc' }],
  })
  const cards = [...set.cards].sort(byLocalId)
  // Části jedné sady se poznají podle kódu: podsada má „CEL:CC“, hlavní sada „CEL“
  // (Celebrations + Classic Collection, Silver Tempest + Trainer Gallery, Crown Zenith + Galarian Gallery…).
  const mainCode = set.code?.split(':')[0]
  const siblings = mainCode
    ? await prisma.cardSet.findMany({
        where: {
          id: { not: set.id },
          language: set.language,
          OR: [{ code: { equals: mainCode, mode: 'insensitive' } }, { code: { startsWith: `${mainCode}:`, mode: 'insensitive' } }],
        },
        select: { id: true, name: true, cardCount: true, logoUrl: true },
        orderBy: { id: 'asc' },
      })
    : []
  // Podsada nemá vlastní logo — půjčí si ho od hlavní sady.
  const logo = setLogo(set.logoUrl ?? siblings.find((s) => s.logoUrl)?.logoUrl ?? null)
  const meta = [set.series, set.code, set.releaseDate?.toLocaleDateString(LOCALE_INFO[locale].intl, { month: 'long', year: 'numeric' })]
  const countLabel = set.officialCount
    ? t('{n} karet ({total} včetně secret)', { n: set.officialCount, total: set.cardCount })
    : t('{n} karet', { n: set.cardCount })

  // Stav sbírky přihlášeného uživatele pro karty této sady.
  const initial: Record<string, QuickState> = {}
  if (user) {
    const ids = cards.map((c) => c.id)
    const [items, wants] = await Promise.all([
      prisma.collectionItem.findMany({ where: { userId: user.id, cardId: { in: ids } } }),
      prisma.wantItem.findMany({ where: { userId: user.id, cardId: { in: ids } }, select: { cardId: true } }),
    ])
    for (const i of items) {
      const s = (initial[i.cardId] ??= { owned: 0, spare: 0, want: false, variants: {} })
      s.owned += i.quantity
      s.spare += i.spareQty
      if (i.quantity > 0) s.variants![i.variant] = (s.variants![i.variant] ?? 0) + i.quantity
    }
    for (const w of wants) (initial[w.cardId] ??= { owned: 0, spare: 0, want: false }).want = true
  }

  // Souhrn sbírky přihlášeného v této sadě: kolik karet má, kolik chybí do kompletu, odhad hodnoty.
  const ownedIds = cards.filter((c) => (initial[c.id]?.owned ?? 0) > 0)
  const ownedValue = formatCzk(ownedIds.reduce((sum, c) => sum + Number(c.priceEur ?? 0) * (initial[c.id]?.owned ?? 0), 0))
  const total = set.officialCount || set.cardCount
  const missing = picked ? Math.max(0, picked.total - picked.owned) : Math.max(0, total - ownedIds.length)

  return (
    <main className="mx-auto max-w-page px-4 pb-10 pt-6 sm:px-6">
      <JsonLd
        data={breadcrumbs([
          { name: t('Sady'), url: '/sady' },
          { name: setDisplayName(set), url: `/sady/${encodeURIComponent(set.id)}` },
        ])}
      />
      <nav aria-label={t('Drobečková navigace')} className="flex items-center gap-1.5 text-sm text-subtle">
        <Link href="/sady" className="text-muted hover:text-fg">
          {t('Sady')}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        {set.series && set.series !== setDisplayName(set) && (
          <>
            <span>{set.series}</span>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </>
        )}
        <span className="truncate text-fg">{setDisplayName(set)}</span>
      </nav>

      <header className={`${panel} relative mt-4 overflow-hidden p-6 sm:p-8`}>
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:gap-9">
          <div className="grid h-[110px] w-full shrink-0 place-items-center rounded-2xl bg-surface ring-1 ring-inset ring-line md:w-[210px]">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="" className="max-h-20 w-auto max-w-[170px] object-contain" />
            ) : (
              <CardBack />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="eyebrow">{meta.filter(Boolean).join(' · ')}</p>
            <h1 className="mt-2 text-3xl font-semibold text-fg sm:text-[44px] sm:leading-[1.05]">
              {setDisplayName(set)}
              {set.language === 'ja' && (
                <span className="ml-3 inline-flex items-center rounded-[7px] bg-[#fdecea] px-2 py-0.5 align-middle font-sans text-xs font-semibold tracking-normal text-[#b42318] ring-1 ring-inset ring-[#f6cfca] dark:bg-[rgba(216,52,26,0.16)] dark:text-[#ff9b8a] dark:ring-[rgba(216,52,26,0.35)]">
                  {t('Japonská')}
                </span>
              )}
            </h1>
            {set.nameOriginal && <p className="mt-1 text-sm text-subtle">{set.nameOriginal}</p>}
            {user && tab === 'karty' && (
              <p className="mt-3 text-sm text-muted">
                {t('Přepni dole na „Mám“ a klepáním označ karty, které máš. U karty s víc verzemi (normal, holo, reverse) si vybereš, kterou máš.')}
              </p>
            )}
            {siblings.length > 0 && (
              <p className="mt-3 inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-surface px-3 py-2 text-sm text-muted ring-1 ring-inset ring-line">
                <Layers className="h-4 w-4 shrink-0 text-accent" strokeWidth={1.75} aria-hidden />
                {t('Tahle sada má další část:')}
                {siblings.map((s) => (
                  <Link key={s.id} href={`/sady/${encodeURIComponent(s.id)}`} className="font-semibold text-accent hover:underline">
                    {setDisplayName(s)} ({t('{n} karet', { n: s.cardCount })})
                  </Link>
                ))}
              </p>
            )}
            {user ? (
              <dl className="mt-5 flex flex-wrap gap-y-3">
                {[
                  [
                    <>
                      {picked?.owned ?? ownedIds.length}
                      <span className="text-xl text-subtle"> / {picked?.total ?? total}</span>
                    </>,
                    goal === 'master' ? t('variant ve sbírce') : t('karet ve sbírce'),
                  ],
                  [missing, t(GOAL_MISSING[goal])],
                  ...(ownedValue && ownedIds.length ? [[`≈ ${ownedValue}`, t('hodnota tvých karet')]] : []),
                ].map(([v, label], n) => (
                  <div key={n} className={n ? 'border-l border-line pl-6 pr-6' : 'pr-6'}>
                    <dt className="sr-only">{label}</dt>
                    <dd className="font-display text-[28px] font-semibold leading-tight tabular-nums text-fg">{v}</dd>
                    <dd className="text-sm text-muted">{label}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-3 font-mono text-[13px] text-muted">{countLabel}</p>
            )}
          </div>
        </div>
        {progress && (
          <div className="relative mt-7 border-t border-line pt-6">
            <GoalPicker setId={set.id} goal={goal} hasBase={!!progress.base} />
            <div className="mt-5">
              <ProgressBars p={progress} active={goal} />
            </div>
            <ShareSet setId={set.id} setName={setDisplayName(set)} missing={missing} />
          </div>
        )}
      </header>

      {cards.length > 0 && cards.every((c) => !c.imageUrl) && (
        <p className="mt-6 flex items-start gap-3 rounded-panel border border-line bg-[color-mix(in_srgb,var(--brand-yellow)_14%,transparent)] p-4 text-sm text-fg">
          <ImageOff className="mt-0.5 h-4.5 w-4.5 shrink-0 text-accent" strokeWidth={1.75} aria-hidden />
          <span>
            <strong>{t('Čekáme na oficiální obrázky karet.')}</strong>{' '}
            {t('Seznam karet už je kompletní, obrázky doplníme automaticky, jakmile je vydavatel zveřejní (obvykle pár dní po vydání). Odklikávat si, co máš, můžeš už teď.')}
          </span>
        </p>
      )}

      {/* Karty / Produkty jako výrazný přepínač (záložka s podtržením se přehlížela — produkty nikdo nenašel). */}
      <nav aria-label={t('Karty nebo produkty')} className="mt-7 inline-flex gap-1 rounded-xl bg-surface p-1 ring-1 ring-inset ring-line">
        {(
          [
            ['karty', t('Karty ({n})', { n: cards.length }), t('jednotlivé karty sady'), Layers],
            ['produkty', t('Produkty ({n})', { n: products.length }), t('ETB, boostery, tiny, balíčky'), Package],
          ] as const
        ).map(([k, label, hint, Icon]) => (
          <Link
            key={k}
            href={`/sady/${encodeURIComponent(set.id)}${k === 'produkty' ? '?tab=produkty' : ''}`}
            aria-current={tab === k ? 'page' : undefined}
            className={`flex min-h-12 items-center gap-2.5 rounded-[9px] px-4 transition-colors ${tab === k ? 'bg-card text-fg shadow-soft ring-1 ring-inset ring-line' : 'text-muted hover:text-fg'}`}
          >
            <Icon className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden />
            <span className="leading-tight">
              <span className="block text-[15px] font-semibold">{label}</span>
              <span className="block text-xs text-subtle">{hint}</span>
            </span>
          </Link>
        ))}
      </nav>

      {tab === 'produkty' ? (
        products.length ? (
          <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {products.map((p) => (
              <li key={p.id}>
                <ProductTile p={p} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-6 text-subtle">{t('K této sadě zatím nemáme žádné produkty.')}</p>
        )
      ) : (
      <SetGrid
        loggedIn={!!user}
        initialMode={initialMode}
        showTip={showTip}
        officialCount={set.officialCount || set.cardCount}
        setId={set.id}
        goal={goal}
        baseCount={set.officialCount}
        initial={initial}
        cards={cards.map((c) => ({
          id: c.id,
          localId: c.localId,
          name: c.name,
          image: cardImage(c.imageUrl),
          price: formatEur(c.priceEur),
          types: c.types,
          variants: cardVariants(c),
        }))}
      />
      )}
      <PriceNote className="mt-8" />
    </main>
  )
}
