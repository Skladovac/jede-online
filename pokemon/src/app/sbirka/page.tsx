import { redirect } from 'next/navigation'
import { getCurrentUser, isLimited } from '@/lib/auth'
import { collectionOverview } from '@/lib/collection-view'
import { CollectionOverview } from '@/components/CollectionOverview'
import { ensureEurCzk } from '@/lib/fx'
import { CopyLink } from '@/components/CopyLink'
import { Dashboard } from '@/components/Dashboard'
import { QuickAdd } from '@/components/QuickAdd'
import { ImportExport } from '@/components/ImportExport'
import { interestInMyCards } from '@/lib/interest'
import { cardImage } from '@/lib/format'
import Link from 'next/link'
import { getT } from '@/lib/i18n/server'
import { CardImg } from '@/components/CardImg'

export async function generateMetadata() {
  const t = await getT()
  return { title: t('Moje sbírka') }
}
export const dynamic = 'force-dynamic'

export default async function MyCollectionPage() {
  await ensureEurCzk() // kurz ČNB pro korunové částky u cen
  const user = await getCurrentUser()
  if (!user) redirect('/prihlaseni?next=/sbirka')
  const t = await getT()
  const [data, interest] = await Promise.all([collectionOverview(user.id), interestInMyCards(user.id)])

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-2 text-3xl font-black tracking-tight">{t('Moje sbírka')}</h1>
      {isLimited(user) && (
        <p className="mb-6 text-sm text-accent">
          {t('Dokud rodič nepotvrdí účet, tvoje nabídky ostatní neuvidí.')}
        </p>
      )}
      <div className="mt-6">
        <QuickAdd />
        <p className="mt-2 text-right text-sm">
          <Link href="/sbirka/nabidka" className="font-medium text-accent hover:underline">
            🏷️ {t('Hromadná nabídka: nabídni víc karet najednou')} →
          </Link>
        </p>
      </div>
      <div className="mt-6">
        <Dashboard userId={user.id} />
      </div>
      {!isLimited(user) && data.totals.wanted > 0 && (
        <div className="mt-6 rounded-panel border-2 border-orange-300 bg-orange-50 p-4 dark:border-orange-500/40 dark:bg-orange-500/10">
          {/* Oranžová = „chybí“ (stejně jako okraj chybějících karet v sadě). */}
          <p className="mb-1 flex items-center gap-2 font-bold text-orange-900 dark:text-orange-200">
            <span aria-hidden className="grid h-7 w-7 place-items-center rounded-full bg-orange-500 text-sm text-white">
              🔗
            </span>
            {t('Sdílej, co sháníš')}
          </p>
          <p className="mb-3 text-sm text-orange-900/80 dark:text-orange-200/80">
            {t('Zkopíruj odkaz na seznam karet, které ti chybí, a vlož ho třeba na Facebook nebo do skupiny sběratelů.')}
          </p>
          <CopyLink
            url={`https://pokemon.jede.online/@${encodeURIComponent(user.nickname)}/chybi`}
            title={t('Co hledá {name}', { name: user.nickname })}
          />
        </div>
      )}
      {interest.length > 0 && (
        <section className="mt-6 rounded-panel border-2 border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-500/40 dark:bg-emerald-500/10">
          <h2 className="font-bold text-emerald-900 dark:text-emerald-200">💰 {t('O tvoje karty je zájem ({count})', { count: interest.length })}</h2>
          <p className="mb-3 text-sm text-emerald-900/80 dark:text-emerald-200/80">
            {t('Tyhle karty máš ve sbírce a někdo je chce koupit. Klikni na kartu a uvidíš kdo a za kolik.')}
          </p>
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {interest.map((i) => {
              const img = cardImage(i.card.imageUrl)
              return (
                <li key={i.card.id}>
                  <Link href={`/karta/${encodeURIComponent(i.card.id)}`} className="block">
                    <div className="aspect-[63/88] overflow-hidden rounded-lg bg-surface shadow-sm">
                      {img && (
                        <CardImg src={img} alt={i.card.name} />
                      )}
                    </div>
                    <p className="mt-1 truncate text-xs font-medium">{i.card.name}</p>
                    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                      {i.buyers}× {t('zájem')}{i.best ? ` · ${t('až {price} Kč', { price: i.best.toLocaleString('cs-CZ') })}` : ''}
                    </p>
                    {!i.spare && <p className="text-xs text-subtle">{t('zatím nenabízíš')}</p>}
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      )}
      <div className="mt-6">
        <CollectionOverview data={data} own />
      </div>
      <div className="mt-10">
        <ImportExport />
      </div>
    </main>
  )
}
