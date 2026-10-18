import type { Metadata } from 'next'
import Link from 'next/link'
import { UpcomingBanner } from '@/components/UpcomingBanner'
import { prisma } from '@/lib/prisma'
import { SetTile } from '@/components/SetTile'
import { getT } from '@/lib/i18n/server'
import { subsetLabels } from '@/lib/format'

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
      <p className="eyebrow">{t('Katalog')}</p>
      <h1 className="mt-2 text-4xl font-extrabold text-fg sm:text-[44px]">{t('Všechny sady')}</h1>
      <UpcomingBanner className="mt-6" />
      <nav className="mt-6 flex gap-6 border-b border-line">
        {(
          [
            ['en', t('Anglické sady')],
            ['ja', t('Japonské sady')],
          ] as const
        ).map(([l, label]) => (
          <Link
            key={l}
            href={l === 'ja' ? '/sady?jazyk=ja' : '/sady'}
            aria-current={l === language ? 'page' : undefined}
            className={`-mb-px border-b-2 py-2.5 text-[15px] font-semibold transition-colors ${
              l === language ? 'border-fg text-fg' : 'border-transparent text-muted hover:text-fg'
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
            className="inline-flex min-h-9 items-center rounded-full bg-card px-3.5 text-sm font-semibold text-muted ring-1 ring-inset ring-line transition hover:text-fg hover:ring-line-strong"
          >
            {series}
          </a>
        ))}
      </div>

      {[...groups.entries()].map(([series, list]) => {
        const labels = subsetLabels(list)
        return (
        <section key={series} id={encodeURIComponent(series)} className="scroll-mt-24 pt-10">
          <h2 className="mb-5 text-2xl font-bold text-fg">{series}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {list.map((s) => (
              <SetTile key={s.id} {...s} subLabel={labels.get(s.id)} />
            ))}
          </div>
        </section>
        )
      })}
    </main>
  )
}
