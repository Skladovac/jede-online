import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { SetTile } from '@/components/SetTile'
import { getCurrentUser } from '@/lib/auth'
import { findCollectorsCached, parsePlace } from '@/lib/matches'
import { CollectorList } from '@/components/CollectorList'
import { LatestOffers } from '@/components/LatestOffers'
import { GettingStarted } from '@/components/GettingStarted'

export const dynamic = 'force-dynamic'

export default async function Home({ searchParams }: { searchParams: Promise<{ vitej?: string }> }) {
  const { vitej } = await searchParams
  const [latest, setCount, cardCount] = await Promise.all([
    prisma.cardSet.findMany({
      where: { game: 'pokemon' },
      orderBy: { releaseDate: { sort: 'desc', nulls: 'last' } },
      take: 8,
    }),
    prisma.cardSet.count({ where: { game: 'pokemon' } }),
    prisma.card.count(),
  ])

  // Přihlášenému: kdo má, co mu chybí (napřed jeho kraj, když tam nikdo není, celé ČR/SK).
  const user = await getCurrentUser()
  let matches = user ? await findCollectorsCached(user.id, parsePlace(undefined, user.region).place, 3) : null
  if (user && matches && !matches.collectors.length && user.region) matches = await findCollectorsCached(user.id, {}, 3)

  return (
    <main className="mx-auto max-w-6xl px-4">
      {/* Nový uživatel: průvodce hned nahoře. */}
      <div className="pt-8">
        {user && vitej && (
          <p className="mb-6 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-900 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-200">
            Účet je založený! Poslali jsme ti e-mail s odkazem pro potvrzení. Když ho nevidíš, podívej se do složky Spam /
            Nevyžádaná pošta a označ ho jako „není spam“.
          </p>
        )}
        {user && <GettingStarted userId={user.id} nickname={user.nickname} emailVerified={!!user.emailVerifiedAt} />}
      </div>

      <section className="py-12 sm:py-16">
        <p className="mb-3 inline-block rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-800 dark:bg-yellow-400/10 dark:text-yellow-300">
          Uzavřené testování
        </p>
        <h1 className="max-w-2xl text-3xl font-black tracking-tight sm:text-5xl">
          Měj přehled o své sbírce a najdi karty, které ti chybí.
        </h1>
        <p className="mt-4 max-w-xl text-lg text-slate-600 dark:text-slate-300">
          Katalog všech anglických sad od roku 1999, vlastní sbírka, seznam chybějících karet a výměny se
          sběrateli z Česka a Slovenska.
        </p>
        <p className="mt-6 text-sm text-slate-500">
          {setCount} sad · {cardCount.toLocaleString('cs-CZ')} karet
        </p>
      </section>


      {matches && (
        <section className="mb-12">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-xl font-bold">Kdo má, co ti chybí</h2>
            <Link href="/sberatele" className="text-sm font-medium text-yellow-700 hover:underline dark:text-yellow-400">
              Najdi sběratele →
            </Link>
          </div>
          {matches.collectors.length ? (
            <CollectorList collectors={matches.collectors} />
          ) : (
            <p className="text-sm text-slate-500">
              {matches.mine.wantCards.length || matches.mine.wantProducts.length
                ? 'Zatím nikdo nemá nic z toho, co ti chybí. Mrkni sem později.'
                : 'Označ si v sadě karty, které ti chybí, a tady uvidíš, kdo je má.'}
            </p>
          )}
        </section>
      )}

      <LatestOffers />

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
              <SetTile key={s.id} {...s} />
            ))}
          </div>
        ) : (
          <p className="text-slate-500">Katalog se právě načítá. Zkus to za pár minut.</p>
        )}
      </section>
    </main>
  )
}
