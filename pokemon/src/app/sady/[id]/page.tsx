import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { byLocalId, cardImage, formatEur, setLogo } from '@/lib/format'
import { PriceNote } from '@/components/PriceNote'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

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

export default async function SetPage({ params }: Props) {
  const set = await getSet((await params).id)
  if (!set) notFound()
  const cards = [...set.cards].sort(byLocalId)
  const logo = setLogo(set.logoUrl)
  const meta = [
    set.series,
    set.code,
    `${set.officialCount} karet (${set.cardCount} včetně secret)`,
    set.releaseDate?.toLocaleDateString('cs-CZ'),
  ]

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Link href="/sady" className="text-sm text-slate-500 hover:underline">
        ← Všechny sady
      </Link>
      <header className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
        {logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" className="h-16 w-auto max-w-[200px] object-contain" />
        )}
        <div>
          <h1 className="text-3xl font-black tracking-tight">{set.name}</h1>
          <p className="mt-1 text-sm text-slate-500">{meta.filter(Boolean).join(' · ')}</p>
        </div>
      </header>

      <ul className="mt-8 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {cards.map((c) => {
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
                <p className="mt-1.5 truncate text-xs font-medium">
                  <span className="text-slate-400">{c.localId}</span> {c.name}
                </p>
                {price && <p className="text-xs text-slate-500">≈ {price}</p>}
              </Link>
            </li>
          )
        })}
      </ul>
      <PriceNote className="mt-8" />
    </main>
  )
}
