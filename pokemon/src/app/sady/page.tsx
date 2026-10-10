import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { SetTile } from '@/components/SetTile'
import { getT } from '@/lib/i18n/server'

export const dynamic = 'force-dynamic'
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t('Všechny sady') }
}

export default async function SetsPage({ searchParams }: { searchParams: Promise<{ jazyk?: string }> }) {
  const t = await getT()
  // Anglické (výchozí) nebo japonské sady.
  const language = (await searchParams).jazyk === 'ja' ? 'ja' : 'en'
  const sets = await prisma.cardSet.findMany({
    where: { game: 'pokemon', language },
    orderBy: { releaseDate: { sort: 'desc', nulls: 'last' } },
  })


  // Seskupení podle éry (série) v pořadí od nejnovější.
  const groups = new Map<string, typeof sets>()
  for (const s of sets) groups.set(s.series, [...(groups.get(s.series) ?? []), s])

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-black tracking-tight">{t('Všechny sady')}</h1>
      <nav className="mt-4 flex gap-2 border-b border-line">
        {(
          [
            ['en', t('Anglické sady')],
            ['ja', t('Japonské sady')],
          ] as const
        ).map(([l, label]) => (
          <Link
            key={l}
            href={l === 'ja' ? '/sady?jazyk=ja' : '/sady'}
            className={`-mb-px border-b-2 px-4 py-2 font-semibold ${
              l === language ? 'border-accent text-fg' : 'border-transparent text-subtle hover:text-fg'
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>
      <p className="mt-3 text-muted">
        {language === 'ja'
          ? t('{n} japonských sad z ér Scarlet & Violet a Mega, od nejnovějších. Japonské sady mají jiné složení než anglické.', { n: sets.length })
          : t('{n} anglických sad, od nejnovějších.', { n: sets.length })}
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {[...groups.keys()].map((series) => (
          <a
            key={series}
            href={`#${encodeURIComponent(series)}`}
            className="rounded-full border border-line-strong px-3 py-1 text-sm hover:border-line-strong"
          >
            {series}
          </a>
        ))}
      </div>

      {[...groups.entries()].map(([series, list]) => (
        <section key={series} id={encodeURIComponent(series)} className="scroll-mt-24 pt-10">
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
