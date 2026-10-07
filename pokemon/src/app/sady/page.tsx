import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { SetTile } from '@/components/SetTile'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Všechny sady' }

export default async function SetsPage() {
  const sets = await prisma.cardSet.findMany({
    where: { game: 'pokemon' },
    orderBy: { releaseDate: { sort: 'desc', nulls: 'last' } },
  })


  // Seskupení podle éry (série) v pořadí od nejnovější.
  const groups = new Map<string, typeof sets>()
  for (const s of sets) groups.set(s.series, [...(groups.get(s.series) ?? []), s])

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-black tracking-tight">Všechny sady</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-300">{sets.length} anglických sad, od nejnovějších.</p>

      <div className="mt-6 flex flex-wrap gap-2">
        {[...groups.keys()].map((series) => (
          <a
            key={series}
            href={`#${encodeURIComponent(series)}`}
            className="rounded-full border border-slate-300 px-3 py-1 text-sm hover:border-yellow-400 dark:border-slate-700"
          >
            {series}
          </a>
        ))}
      </div>

      {[...groups.entries()].map(([series, list]) => (
        <section key={series} id={encodeURIComponent(series)} className="scroll-mt-20 pt-10">
          <h2 className="mb-4 text-xl font-bold">{series}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {list.map((s) => (
              <SetTile key={s.id} {...s} />
            ))}
          </div>
        </section>
      ))}
    </main>
  )
}
