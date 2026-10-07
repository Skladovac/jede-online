import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentUser, isLimited } from '@/lib/auth'
import { collectionOverview } from '@/lib/collection-view'
import { CollectionOverview } from '@/components/CollectionOverview'
import { ensureEurCzk } from '@/lib/fx'
import { CopyLink } from '@/components/CopyLink'

export const metadata: Metadata = { title: 'Moje sbírka' }
export const dynamic = 'force-dynamic'

export default async function MyCollectionPage() {
  await ensureEurCzk() // kurz ČNB pro korunové částky u cen
  const user = await getCurrentUser()
  if (!user) redirect('/prihlaseni?next=/sbirka')
  const data = await collectionOverview(user.id)

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-2 text-3xl font-black tracking-tight">Moje sbírka</h1>
      {isLimited(user) && (
        <p className="mb-6 text-sm text-yellow-700 dark:text-yellow-400">
          Dokud rodič nepotvrdí účet, tvoje nabídky ostatní neuvidí.
        </p>
      )}
      {!isLimited(user) && data.totals.wanted > 0 && (
        <div className="mt-6 rounded-2xl border-2 border-orange-300 bg-orange-50 p-4 dark:border-orange-500/40 dark:bg-orange-500/10">
          {/* Oranžová = „chybí“ (stejně jako okraj chybějících karet v sadě). */}
          <p className="mb-1 flex items-center gap-2 font-bold text-orange-900 dark:text-orange-200">
            <span aria-hidden className="grid h-7 w-7 place-items-center rounded-full bg-orange-500 text-sm text-white">
              🔗
            </span>
            Pochlub se, co sháníš
          </p>
          <p className="mb-3 text-sm text-orange-900/80 dark:text-orange-200/80">
            Zkopíruj odkaz na seznam karet, které ti chybí, a vlož ho třeba na Facebook nebo do skupiny sběratelů.
          </p>
          <CopyLink
            url={`https://pokemon.jede.online/u/${encodeURIComponent(user.nickname)}/chybi`}
            title={`Co hledá ${user.nickname}`}
          />
        </div>
      )}
      <div className="mt-6">
        <CollectionOverview data={data} own />
      </div>
    </main>
  )
}
