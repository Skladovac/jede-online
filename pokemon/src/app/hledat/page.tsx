import type { Metadata } from 'next'
import Link from 'next/link'
import { searchCards, searchProducts } from '@/lib/search'
import { ProductTile } from '@/components/ProductTile'
import { cardImage, formatEur } from '@/lib/format'
import { PriceNote } from '@/components/PriceNote'
import { ensureEurCzk } from '@/lib/fx'
import { getT } from '@/lib/i18n/server'
import { CardImg } from '@/components/CardImg'
import { EmptyState } from '@/components/design'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ q?: string }> }

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = await searchParams
  const t = await getT()
  return { title: q ? t('Hledání: {q}', { q }) : t('Hledání') }
}

export default async function SearchPage({ searchParams }: Props) {
  const t = await getT()
  await ensureEurCzk() // kurz ČNB pro korunové částky u cen
  const q = ((await searchParams).q ?? '').trim()
  const [hits, products] = await Promise.all([searchCards(q, 60), searchProducts(q, 24)])

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-black tracking-tight">{q ? t('Výsledky pro „{q}“', { q }) : t('Hledání')}</h1>
      <p className="mt-1 text-sm text-subtle">
        {q.length < 2
          ? t('Napiš aspoň 2 znaky. Hledat jde podle jména (Charizard) nebo kódu z karty (SVI 045, 045/198).')
          : hits.length === 60
            ? t('Zobrazujeme prvních 60 výsledků, upřesni hledání.')
            : `${hits.length} ${t('karet')}`}
      </p>

      {q.length >= 2 && hits.length === 0 && products.length === 0 && (
        <EmptyState className="mt-8">{t('Nic jsme nenašli. Zkus jen část jména nebo kód sady a číslo z dolního rohu karty.')}</EmptyState>
      )}

      <ul className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {hits.map((c) => {
          const img = cardImage(c.imageUrl)
          const price = formatEur(c.priceEur)
          return (
            <li key={c.id}>
              <Link href={`/karta/${encodeURIComponent(c.id)}`} className="group block">
                <div className="aspect-[63/88] overflow-hidden rounded-lg bg-surface shadow-sm transition group-hover:-translate-y-0.5 group-hover:shadow-md">
                  {img ? (
                    <CardImg src={img} alt={c.name} />
                  ) : (
                    <div className="grid h-full place-items-center p-2 text-center text-xs text-subtle">{c.name}</div>
                  )}
                </div>
                <p className="mt-1.5 truncate text-xs font-medium">{c.name}</p>
                <p className="truncate text-xs text-subtle">
                  {c.set.name} · {c.localId}
                </p>
                {price && <p className="text-xs text-subtle">≈ {price}</p>}
              </Link>
            </li>
          )
        })}
      </ul>
      {products.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-xl font-bold">{t('Produkty')} ({products.length})</h2>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {products.map((p) => (
              <li key={p.id}>
                <ProductTile p={p} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {(hits.length > 0 || products.length > 0) && <PriceNote className="mt-8" />}
    </main>
  )
}
