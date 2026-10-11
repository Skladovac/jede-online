import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { getCurrentUser, isLimited } from '@/lib/auth'
import { AUCTION_SITES, MAX_AUCTION_ITEMS } from '@/lib/auctions'
import { AuctionForm } from '@/components/AuctionForm'
import { panel } from '@/components/design'
import { getT } from '@/lib/i18n/server'

export async function generateMetadata() {
  const t = await getT()
  return { title: t('Nová aukce'), robots: { index: false } }
}
export const dynamic = 'force-dynamic'

export default async function NewAuctionPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/prihlaseni?next=/aukce/nova')
  const t = await getT()
  const blocked = !user.emailVerifiedAt
    ? t('Aukci můžeš založit po potvrzení e-mailu (odkaz najdeš v Můj účet).')
    : isLimited(user)
      ? t('Aukce půjde zakládat, až rodič potvrdí tvůj účet.')
      : null
  return (
    <main className="mx-auto max-w-3xl px-4 pb-10 pt-6">
      <nav aria-label={t('Drobečková navigace')} className="flex items-center gap-1.5 text-sm text-subtle">
        <Link href="/aukce" className="text-muted hover:text-fg">
          {t('Aukce')}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        <span className="text-fg">{t('Nová aukce')}</span>
      </nav>
      <h1 className="mt-4 text-4xl font-extrabold text-fg sm:text-[44px]">{t('Nová aukce')}</h1>
      <p className="mt-3 text-muted">
        {t('Aukce běží na Facebooku, Aukru nebo jinde — sem dáš jen odkaz, co dražíš a kdy aukce končí. Kdo kartu hledá, dostane upozornění.')}
      </p>
      <div className={`${panel} mt-8 p-6 sm:p-8`}>{blocked ? <p className="text-muted">{blocked}</p> : <AuctionForm sites={AUCTION_SITES} maxItems={MAX_AUCTION_ITEMS} />}</div>
    </main>
  )
}
