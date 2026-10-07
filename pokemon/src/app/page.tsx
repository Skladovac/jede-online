import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { SetTile } from '@/components/SetTile'
import { setFallbackImages } from '@/lib/set-images'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const [latest, setCount, cardCount] = await Promise.all([
    prisma.cardSet.findMany({
      where: { game: 'pokemon' },
      orderBy: { releaseDate: { sort: 'desc', nulls: 'last' } },
      take: 8,
    }),
    prisma.cardSet.count({ where: { game: 'pokemon' } }),
    prisma.card.count(),
  ])
  const fallback = await setFallbackImages(latest)

  return (
    <main className="mx-auto max-w-6xl px-4">
      <section className="py-12 sm:py-16">
        <p className="mb-3 inline-block rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-800 dark:bg-yellow-400/10 dark:text-yellow-300">
          Uzavřené testování
        </p>
        <h1 className="max-w-2xl text-3xl font-black tracking-tight sm:text-5xl">
          Měj přehled o své sbírce a najdi karty, které ti chybí.
        </h1>
        <p className="mt-4 max-w-xl text-lg text-slate-600 dark:text-slate-300">
          Katalog všech anglických sad od roku 1999. Brzy: vlastní sbírka, seznam chybějících karet a výměny se
          sběrateli z Česka a Slovenska.
        </p>
        <p className="mt-6 text-sm text-slate-500">
          {setCount} sad · {cardCount.toLocaleString('cs-CZ')} karet
        </p>
      </section>

      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-xl font-bold">Nejnovější sady</h2>
          <Link href="/sady" className="text-sm font-medium text-yellow-700 hover:underline dark:text-yellow-400">
            Všechny sady →
          </Link>
        </div>
        {latest.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {latest.map((s) => (
              <SetTile key={s.id} {...s} fallbackImage={fallback.get(s.id)} />
            ))}
          </div>
        ) : (
          <p className="text-slate-500">Katalog se právě načítá. Zkus to za pár minut.</p>
        )}
      </section>
    </main>
  )
}
