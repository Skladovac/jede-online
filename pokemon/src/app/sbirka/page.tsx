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
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="mb-2 text-sm font-semibold">Odkaz na to, co ti chybí – zkopíruj ho a vlož třeba na Facebook:</p>
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
