import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { byLocalId, cardImage, formatEur, setLogo } from '@/lib/format'
import { PriceNote } from '@/components/PriceNote'
import { SetGrid } from '@/components/SetGrid'
import { ProductTile } from '@/components/ProductTile'
import { CardBack } from '@/components/CardBack'
import type { QuickState } from '@/app/actions/collection'
import { ensureEurCzk } from '@/lib/fx'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }>; searchParams?: Promise<{ tab?: string }> }

async function getSet(id: string) {
  return prisma.cardSet.findUnique({
    where: { id: decodeURIComponent(id) },
    include: { cards: { select: { id: true, localId: true, name: true, imageUrl: true, priceEur: true } } },
  })
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const set = await getSet((await params).id)
  return { title: set ? set.name : 'Sada nenalezena' }
}

export default async function SetPage({ params, searchParams }: Props) {
  await ensureEurCzk() // kurz ČNB pro korunové částky u cen
  const [set, user] = await Promise.all([getSet((await params).id), getCurrentUser()])
  if (!set) notFound()
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
    set.officialCount ? `${set.officialCount} karet (${set.cardCount} včetně secret)` : `${set.cardCount} karet`,
    set.releaseDate?.toLocaleDateString('cs-CZ'),
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
      <Link href="/sady" className="text-sm text-slate-500 hover:underline">
        ← Všechny sady
      </Link>
      <header className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" className="h-16 w-auto max-w-[200px] object-contain" />
        ) : (
          <CardBack />
        )}
        <div>
          <h1 className="text-3xl font-black tracking-tight">{set.name}</h1>
          <p className="mt-1 text-sm text-slate-500">{meta.filter(Boolean).join(' · ')}</p>
        </div>
      </header>

      <nav className="mt-6 flex gap-2 border-b border-slate-200 dark:border-slate-800">
        {[
          ['karty', `Karty (${cards.length})`],
          ['produkty', `Produkty (${products.length})`],
        ].map(([t, label]) => (
          <Link
            key={t}
            href={`/sady/${encodeURIComponent(set.id)}${t === 'produkty' ? '?tab=produkty' : ''}`}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${tab === t ? 'border-yellow-500' : 'border-transparent text-slate-500'}`}
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
          <p className="mt-6 text-slate-500">K této sadě zatím nemáme žádné produkty.</p>
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
        }))}
      />
      )}
      <PriceNote className="mt-8" />
    </main>
  )
}
