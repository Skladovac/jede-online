import type { Metadata } from 'next'
import Link from 'next/link'
import { searchCards } from '@/lib/search'
import { cardImage, formatEur } from '@/lib/format'
import { PriceNote } from '@/components/PriceNote'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ q?: string }> }

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = await searchParams
  return { title: q ? `Hledání: ${q}` : 'Hledání' }
}

export default async function SearchPage({ searchParams }: Props) {
  const q = ((await searchParams).q ?? '').trim()
  const hits = await searchCards(q, 60)

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-black tracking-tight">{q ? <>Výsledky pro „{q}“</> : 'Hledání'}</h1>
      <p className="mt-1 text-sm text-slate-500">
        {q.length < 2
          ? 'Napiš aspoň 2 znaky. Hledat jde podle jména (Charizard) nebo kódu z karty (SVI 045, 045/198).'
          : hits.length === 60
            ? 'Zobrazujeme prvních 60 výsledků, upřesni hledání.'
            : `${hits.length} karet`}
      </p>

      {q.length >= 2 && hits.length === 0 && (
        <p className="mt-8 text-slate-500">
          Nic jsme nenašli. Zkus jen část jména nebo kód sady a číslo z dolního rohu karty.
        </p>
      )}

      <ul className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {hits.map((c) => {
          const img = cardImage(c.imageUrl)
          const price = formatEur(c.priceEur)
          return (
            <li key={c.id}>
              <Link href={`/karta/${encodeURIComponent(c.id)}`} className="group block">
                <div className="aspect-[63/88] overflow-hidden rounded-lg bg-slate-200 shadow-sm transition group-hover:-translate-y-0.5 group-hover:shadow-md dark:bg-slate-800">
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt={c.name} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center p-2 text-center text-xs text-slate-500">{c.name}</div>
                  )}
                </div>
                <p className="mt-1.5 truncate text-xs font-medium">{c.name}</p>
                <p className="truncate text-xs text-slate-500">
                  {c.set.name} · {c.localId}
                </p>
                {price && <p className="text-xs text-slate-500">≈ {price}</p>}
              </Link>
            </li>
          )
        })}
      </ul>
      {hits.length > 0 && <PriceNote className="mt-8" />}
    </main>
  )
}
