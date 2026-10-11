import { redirect } from 'next/navigation'
import { getCurrentUser, isLimited } from '@/lib/auth'
import { collectionOverview } from '@/lib/collection-view'
import { CollectionOverview } from '@/components/CollectionOverview'
import { ensureEurCzk } from '@/lib/fx'
import { CopyLink } from '@/components/CopyLink'
import { Dashboard } from '@/components/Dashboard'
import { QuickAdd } from '@/components/QuickAdd'
import { visionEnabled } from '@/lib/card-vision'
import { PHOTO_DAILY, photoQuota } from '@/lib/photo-quota'
import { ImportExport } from '@/components/ImportExport'
import { interestInMyCards } from '@/lib/interest'
import { cardImage } from '@/lib/format'
import Link from 'next/link'
import { getT } from '@/lib/i18n/server'
import { CardImg } from '@/components/CardImg'
import { panel } from '@/components/design'
import { ArrowRight, Coins, Link2, Printer, Tag } from 'lucide-react'

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
      <h1 className="mb-2 text-4xl font-extrabold text-fg sm:text-[44px]">{t('Moje sbírka')}</h1>
      {isLimited(user) && (
        <p className="mb-6 text-sm text-accent">
          {t('Dokud rodič nepotvrdí účet, tvoje nabídky ostatní neuvidí.')}
        </p>
      )}
      <div className="mt-6">
        <QuickAdd photo={visionEnabled()} quota={visionEnabled() ? await photoQuota(user) : undefined} photoDaily={PHOTO_DAILY} />
        <p className="mt-2 flex flex-wrap justify-end gap-x-6 gap-y-1 text-sm">
          <Link href="/sbirka/tisk" className="inline-flex items-center gap-1.5 font-semibold text-accent underline-offset-4 hover:underline">
            <Printer className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            {t('Vytisknout seznam chybějících')}
          </Link>
          <Link href="/sbirka/nabidka" className="inline-flex items-center gap-1.5 font-semibold text-accent underline-offset-4 hover:underline">
            <Tag className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            {t('Hromadná nabídka: nabídni víc karet najednou')}
            <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </Link>
        </p>
      </div>
      <div className="mt-6">
        <Dashboard userId={user.id} />
      </div>
      {!isLimited(user) && data.totals.wanted > 0 && (
        <div className={`mt-6 ${panel} p-5`}>
          <p className="mb-1 flex items-center gap-3 text-lg font-bold text-fg">
            <span aria-hidden className="grid h-9 w-9 place-items-center rounded-[11px] bg-[var(--ink)] text-brand-yellow dark:bg-brand-yellow dark:text-[var(--ink)]">
              <Link2 className="h-[18px] w-[18px]" strokeWidth={1.75} />
            </span>
            {t('Sdílej, co sháníš')}
          </p>
          <p className="mb-3 text-sm text-muted">
            {t('Zkopíruj odkaz na seznam karet, které ti chybí, a vlož ho třeba na Facebook nebo do skupiny sběratelů.')}
          </p>
          <CopyLink
            url={`https://pokemon.jede.online/@${encodeURIComponent(user.nickname)}?ukaz=hledam`}
            title={t('Co hledá {name}', { name: user.nickname })}
          />
        </div>
      )}
      {interest.length > 0 && (
        <section className={`mt-6 ${panel} p-5`}>
          <h2 className="mb-1 flex items-center gap-3 text-xl font-bold text-fg">
            <span aria-hidden className="grid h-9 w-9 place-items-center rounded-[11px] bg-[var(--ink)] text-brand-yellow dark:bg-brand-yellow dark:text-[var(--ink)]">
              <Coins className="h-[18px] w-[18px]" strokeWidth={1.75} />
            </span>
            {t('O tvoje karty je zájem ({count})', { count: interest.length })}
          </h2>
          <p className="mb-4 text-sm text-muted">
            {t('Tyhle karty máš ve sbírce a někdo je chce koupit. Klikni na kartu a uvidíš kdo a za kolik.')}
          </p>
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {interest.map((i) => {
              const img = cardImage(i.card.imageUrl)
              return (
                <li key={i.card.id}>
                  <Link href={`/karta/${encodeURIComponent(i.card.id)}`} className="card-tile group block">
                    <div className="card-frame aspect-[63/88]">
                      {img && (
                        <CardImg src={img} alt={i.card.name} />
                      )}
                    </div>
                    <p className="mt-2 truncate text-xs font-semibold text-fg">{i.card.name}</p>
                    <p className="text-xs font-semibold tabular-nums text-positive">
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
