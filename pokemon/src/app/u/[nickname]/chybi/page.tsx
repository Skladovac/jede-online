import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { safeDecode } from '@/lib/validation'
import { getCurrentUser, isLimited } from '@/lib/auth'
import { byLocalId, cardImage } from '@/lib/format'
import { ProductTile } from '@/components/ProductTile'
import { CardImg } from '@/components/CardImg'
import { splitBase } from '@/lib/card-number'
import { BuyBadge } from '@/components/CollectionOverview'
import { ensureEurCzk } from '@/lib/fx'
import { getT, getLocale } from '@/lib/i18n/server'
import { LOCALE_INFO } from '@/lib/i18n/config'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ nickname: string }> }

async function load(nickname: string) {
  const user = await prisma.user.findFirst({
    where: { nickname: { equals: (safeDecode(nickname) ?? ''), mode: 'insensitive' }, bannedAt: null },
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
  const t = await getT()
  const d = await load((await params).nickname)
  if (!d) return { title: t('Profil nenalezen') }
  const title = t('Co hledá {name}', { name: d.user.nickname })
  const description = `${t('Chybí {count} karet', { count: d.cardCount })}${d.products.length ? ` ${t('a {count} produktů', { count: d.products.length })}` : ''}. ${t('Máš něco z toho? Napiš přes pokemon.jede.online.')}`
  return {
    title,
    description,
    robots: d.user.indexable ? undefined : { index: false, follow: false },
    // Náhled při vložení odkazu na Facebook; obrázek dělá opengraph-image.tsx vedle.
    openGraph: { title, description, type: 'website', siteName: t('Pokémon karty'), locale: LOCALE_INFO[await getLocale()].intl.replace('-', '_') },
  }
}

export default async function WantedPage({ params }: Props) {
  await ensureEurCzk()
  const t = await getT()
  const d = await load((await params).nickname)
  if (!d) notFound()
  const viewer = await getCurrentUser()
  const nick = d.user.nickname

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <Link href={`/u/${encodeURIComponent(nick)}`} className="text-sm text-slate-500 hover:underline">
        ← {t('Profil {name}', { name: nick })}
      </Link>
      <h1 className="mt-3 text-3xl font-black tracking-tight">{t('Co hledá {name}', { name: nick })}</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-300">
        {t('Chybí {count} karet', { count: d.cardCount })}{d.products.length > 0 && ` ${t('a {count} produktů', { count: d.products.length })}`}.{' '}
        {viewer ? (
          viewer.id !== d.user.id && (
            <>
              {t('Máš něco z toho? Označ to v sadě jako „Navíc“ a')}{' '}
              <Link href={`/u/${encodeURIComponent(nick)}#shoda`} className="underline">
                {t('podívej se na shodu')}
              </Link>
              .
            </>
          )
        ) : (
          <>
            {t('Máš něco z toho?')}{' '}
            <Link href="/registrace" className="font-semibold underline">
              {t('Zaregistruj se')}
            </Link>{' '}
            {t('a nabídni výměnu.')}
          </>
        )}
      </p>

      {d.sets.length === 0 && d.products.length === 0 && <p className="mt-8 text-slate-500">{t('Zatím nic.')}</p>}

      {d.sets.map(({ set, cards }) => (
        <section key={set.id} className="mt-8">
          <h2 className="mb-3 text-lg font-bold">
            <Link href={`/sady/${encodeURIComponent(set.id)}`} className="hover:underline">
              {set.name}
            </Link>{' '}
            <span className="text-sm font-normal text-slate-500">({cards.length})</span>
          </h2>
          {(() => {
            // Base set (1–oficiální počet) a zvlášť secret rare / karty mimo číslování.
            const { base, extra } = splitBase(cards, (c) => c.localId, set.officialCount)
            const grid = (list: typeof cards) => (
              <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-8">
                {list.map((c) => (
                  <li key={c.id}>
                    <Link href={`/karta/${encodeURIComponent(c.id)}`} className="block">
                      <div className="aspect-[63/88] overflow-hidden rounded-lg bg-slate-200 shadow-sm dark:bg-slate-800">
                        <CardImg src={cardImage(c.imageUrl)} alt={c.name} />
                      </div>
                      <p className="mt-1 truncate text-xs font-medium">{c.name}</p>
                      <p className="text-xs text-slate-500">{c.localId}</p>
                      {d.buy.has(c.id) && <BuyBadge price={d.buy.get(c.id) ?? null} />}
                    </Link>
                  </li>
                ))}
              </ul>
            )
            return (
              <div className="space-y-5">
                {base.length > 0 && (
                  <div>
                    {set.officialCount > 0 && (
                      <h3 className="mb-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                        Base set (1–{set.officialCount}) · {t('chybí {count}', { count: base.length })}
                      </h3>
                    )}
                    {grid(base)}
                  </div>
                )}
                {extra.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-purple-700 dark:text-purple-400">
                      {t('Secret rare a karty mimo číslování')} · {t('chybí {count}', { count: extra.length })}
                    </h3>
                    {grid(extra)}
                  </div>
                )}
              </div>
            )
          })()}
        </section>
      ))}

      {d.products.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-bold">{t('Zapečetěné produkty')}</h2>
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
