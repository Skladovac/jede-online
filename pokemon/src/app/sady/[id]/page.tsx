import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { safeDecode } from '@/lib/validation'
import { getCurrentUser } from '@/lib/auth'
import { setProgress } from '@/lib/progress'
import { ProgressBars } from '@/components/ProgressBars'
import { byLocalId, cardImage, formatEur, setLogo } from '@/lib/format'
import { PriceNote } from '@/components/PriceNote'
import { SetGrid } from '@/components/SetGrid'
import { ProductTile } from '@/components/ProductTile'
import { CardBack } from '@/components/CardBack'
import type { QuickState } from '@/app/actions/collection'
import { ensureEurCzk } from '@/lib/fx'
import { getT, getLocale } from '@/lib/i18n/server'
import { LOCALE_INFO } from '@/lib/i18n/config'
import { setDisplayName } from '@/lib/format'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }>; searchParams?: Promise<{ tab?: string }> }

async function getSet(id: string) {
  return prisma.cardSet.findUnique({
    where: { id: (safeDecode(id) ?? '') },
    include: { cards: { select: { id: true, localId: true, name: true, imageUrl: true, priceEur: true, types: true } } },
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
  return { title, description, openGraph: { title, description } }
}

export default async function SetPage({ params, searchParams }: Props) {
  await ensureEurCzk() // kurz ČNB pro korunové částky u cen
  const t = await getT()
  const locale = await getLocale()
  const [set, user] = await Promise.all([getSet((await params).id), getCurrentUser()])
  if (!set) notFound()
  // Postup přihlášeného (base / complete / master); po změně v mřížce se obnoví při dalším načtení stránky.
  const progress = user ? (await setProgress(user.id, [set.id])).get(set.id) : null
  const tab = (await searchParams)?.tab === 'produkty' ? 'produkty' : 'karty'
  const products = await prisma.product.findMany({
    where: { setId: set.id },
    include: { set: { select: { logoUrl: true } } },
    orderBy: [{ imageUrl: { sort: 'asc', nulls: 'last' } }, { name: 'asc' }],
  })
  const cards = [...set.cards].sort(byLocalId)
  const logo = setLogo(set.logoUrl)
  const meta = [
    set.series,
    set.code,
    set.officialCount
      ? t('{n} karet ({total} včetně secret)', { n: set.officialCount, total: set.cardCount })
      : t('{n} karet', { n: set.cardCount }),
    set.releaseDate?.toLocaleDateString(LOCALE_INFO[locale].intl),
  ]

  // Stav sbírky přihlášeného uživatele pro karty této sady.
  const initial: Record<string, QuickState> = {}
  if (user) {
    const ids = cards.map((c) => c.id)
    const [items, wants] = await Promise.all([
      prisma.collectionItem.findMany({ where: { userId: user.id, cardId: { in: ids } } }),
      prisma.wantItem.findMany({ where: { userId: user.id, cardId: { in: ids } }, select: { cardId: true } }),
    ])
    for (const i of items) {
      const s = (initial[i.cardId] ??= { owned: 0, spare: 0, want: false })
      s.owned += i.quantity
      s.spare += i.spareQty
    }
    for (const w of wants) (initial[w.cardId] ??= { owned: 0, spare: 0, want: false }).want = true
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Link href="/sady" className="text-sm text-subtle hover:underline">
        ← {t('Všechny sady')}
      </Link>
      <header className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" className="h-16 w-auto max-w-[200px] object-contain" />
        ) : (
          <CardBack />
        )}
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            {setDisplayName(set)}
            {set.language === 'ja' && (
              <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 align-middle text-xs font-semibold text-red-800 dark:bg-red-400/10 dark:text-red-300">
                🇯🇵 {t('Japonská')}
              </span>
            )}
          </h1>
          {set.nameOriginal && <p className="text-sm text-subtle">{set.nameOriginal}</p>}
          <p className="mt-1 text-sm text-subtle">{meta.filter(Boolean).join(' · ')}</p>
        </div>
      </header>
      {progress && (
        <div className="mt-5">
          <ProgressBars p={progress} />
        </div>
      )}

      <nav className="mt-6 flex gap-2 border-b border-line">
        {[
          ['karty', t('Karty ({n})', { n: cards.length })],
          ['produkty', t('Produkty ({n})', { n: products.length })],
        ].map(([k, label]) => (
          <Link
            key={k}
            href={`/sady/${encodeURIComponent(set.id)}${k === 'produkty' ? '?tab=produkty' : ''}`}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${tab === k ? 'border-accent text-fg' : 'border-transparent text-subtle'}`}
          >
            {label}
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
        officialCount={set.officialCount || set.cardCount}
        setId={set.id}
        baseCount={set.officialCount}
        initial={initial}
        cards={cards.map((c) => ({
          id: c.id,
          localId: c.localId,
          name: c.name,
          image: cardImage(c.imageUrl),
          price: formatEur(c.priceEur),
          types: c.types,
        }))}
      />
      )}
      <PriceNote className="mt-8" />
    </main>
  )
}
