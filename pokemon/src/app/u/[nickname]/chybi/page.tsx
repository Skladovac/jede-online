import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, isLimited } from '@/lib/auth'
import { byLocalId, cardImage } from '@/lib/format'
import { ProductTile } from '@/components/ProductTile'
import { BuyBadge } from '@/components/CollectionOverview'
import { ensureEurCzk } from '@/lib/fx'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ nickname: string }> }

async function load(nickname: string) {
  const user = await prisma.user.findFirst({
    where: { nickname: { equals: decodeURIComponent(nickname), mode: 'insensitive' }, bannedAt: null },
  })
  if (!user || isLimited(user)) return null
  const [wants, productWants] = await Promise.all([
    prisma.wantItem.findMany({ where: { userId: user.id }, include: { card: { include: { set: true } } } }),
    prisma.productWant.findMany({
      where: { userId: user.id },
      include: { product: { include: { set: { select: { logoUrl: true } } } } },
      orderBy: { createdAt: 'desc' },
    }),
  ])
  // Seskupit po sadách, nejnovější sada napřed.
  const bySet = new Map<string, { set: (typeof wants)[number]['card']['set']; cards: (typeof wants)[number]['card'][] }>()
  for (const w of wants) {
    const e = bySet.get(w.card.setId) ?? { set: w.card.set, cards: [] }
    if (!e.cards.some((c) => c.id === w.cardId)) e.cards.push(w.card)
    bySet.set(w.card.setId, e)
  }
  const sets = [...bySet.values()]
    .map((e) => ({ ...e, cards: e.cards.sort(byLocalId) }))
    .sort((a, b) => (b.set.releaseDate?.getTime() ?? 0) - (a.set.releaseDate?.getTime() ?? 0))
  const cardCount = sets.reduce((s, e) => s + e.cards.length, 0)
  // Poptávky „chci koupit“: cardId → nejvyšší cena (null = cena dohodou).
  const buy = new Map(wants.filter((w) => w.buy).map((w) => [w.cardId, w.maxPriceCzk]))
  return { user, sets, cardCount, buy, products: productWants.map((w) => ({ ...w.product, buy: w.buy, maxPriceCzk: w.maxPriceCzk })) }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = await load((await params).nickname)
  if (!d) return { title: 'Profil nenalezen' }
  const title = `Co hledá ${d.user.nickname}`
  const description = `Chybí ${d.cardCount} karet${d.products.length ? ` a ${d.products.length} produktů` : ''}. Máš něco z toho? Napiš přes pokemon.jede.online.`
  return {
    title,
    description,
    robots: d.user.indexable ? undefined : { index: false, follow: false },
    // Náhled při vložení odkazu na Facebook; obrázek dělá opengraph-image.tsx vedle.
    openGraph: { title, description, type: 'website', siteName: 'Pokémon karty', locale: 'cs_CZ' },
  }
}

export default async function WantedPage({ params }: Props) {
  await ensureEurCzk()
  const d = await load((await params).nickname)
  if (!d) notFound()
  const viewer = await getCurrentUser()
  const nick = d.user.nickname

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <Link href={`/u/${encodeURIComponent(nick)}`} className="text-sm text-slate-500 hover:underline">
        ← Profil {nick}
      </Link>
      <h1 className="mt-3 text-3xl font-black tracking-tight">Co hledá {nick}</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-300">
        Chybí {d.cardCount} karet{d.products.length > 0 && ` a ${d.products.length} produktů`}.{' '}
        {viewer ? (
          viewer.id !== d.user.id && (
            <>
              Máš něco z toho? Označ to v sadě jako „Navíc“ a{' '}
              <Link href={`/u/${encodeURIComponent(nick)}#shoda`} className="underline">
                podívej se na shodu
              </Link>
              .
            </>
          )
        ) : (
          <>
            Máš něco z toho?{' '}
            <Link href="/registrace" className="font-semibold underline">
              Zaregistruj se
            </Link>{' '}
            a nabídni výměnu.
          </>
        )}
      </p>

      {d.sets.length === 0 && d.products.length === 0 && <p className="mt-8 text-slate-500">Zatím nic.</p>}

      {d.sets.map(({ set, cards }) => (
        <section key={set.id} className="mt-8">
          <h2 className="mb-3 text-lg font-bold">
            <Link href={`/sady/${encodeURIComponent(set.id)}`} className="hover:underline">
              {set.name}
            </Link>{' '}
            <span className="text-sm font-normal text-slate-500">({cards.length})</span>
          </h2>
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-8">
            {cards.map((c) => {
              const img = cardImage(c.imageUrl)
              return (
                <li key={c.id}>
                  <Link href={`/karta/${encodeURIComponent(c.id)}`} className="block">
                    <div className="aspect-[63/88] overflow-hidden rounded-lg bg-slate-200 shadow-sm dark:bg-slate-800">
                      {img && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img} alt={c.name} loading="lazy" className="h-full w-full object-cover" />
                      )}
                    </div>
                    <p className="mt-1 truncate text-xs font-medium">{c.name}</p>
                    <p className="text-xs text-slate-500">{c.localId}</p>
                    {d.buy.has(c.id) && <BuyBadge price={d.buy.get(c.id) ?? null} />}
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      {d.products.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-bold">Zapečetěné produkty</h2>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
            {d.products.map((p) => (
              <li key={p.id}>
                <ProductTile p={p} extra={p.buy ? <BuyBadge price={p.maxPriceCzk} /> : undefined} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
