import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { BugReportForm } from '@/components/BugReportForm'
import { InstallApp } from '@/components/InstallApp'
import { container } from '@/components/design'
import { getT } from '@/lib/i18n/server'

const link = 'hover:text-fg hover:underline'

export async function SiteFooter() {
  const user = await getCurrentUser()
  const t = await getT()
  return (
    <footer className="mt-20 border-t border-line bg-surface text-sm text-muted">
      <div className={`${container} grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr]`}>
        <div>
          <p className="flex items-center gap-2 font-bold text-fg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="" width={24} height={24} className="h-6 w-6" />
            pokemon.jede.online
          </p>
          <p className="mt-2 max-w-sm">{t('Komunitní projekt · zdarma a bez reklam')}</p>
        </div>
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-subtle">{t('Informace')}</p>
          <ul className="space-y-2">
            <li>
              <a href="/soukromi" className={link}>
                {t('Pravidla a ochrana osobních údajů')}
              </a>
            </li>
            <li>
              <Link href="/bezpecny-obchod" className={link}>
                {t('Bezpečný obchod')}
              </Link>
            </li>
            <li>
              <a href="mailto:pokemon@jede.online" className={link}>
                pokemon@jede.online
              </a>
            </li>
          </ul>
        </div>
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-subtle">{t('Nástroje')}</p>
          <ul className="space-y-2">
            <li>
              <BugReportForm loggedIn={!!user} />
            </li>
            <li>
              <InstallApp />
            </li>
            {user?.isAdmin && (
              <li>
                <Link href="/admin" className={link}>
                  {t('Administrace')}
                </Link>
              </li>
            )}
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <div className={`${container} flex flex-col gap-2 py-5 text-xs text-subtle sm:flex-row sm:items-center sm:justify-between`}>
          <p className="max-w-3xl">
            {t(
              'Neoficiální fanouškovský projekt. Pokémon a názvy karet jsou ochranné známky jejich vlastníků (Nintendo, The Pokémon Company). Data katalogu: TCGdex.',
            )}
          </p>
          <p className="shrink-0">
            Designed by{' '}
            <a href="https://jede.online" className="font-semibold text-[#C9A961] hover:text-[#D4AF37]">
              jede.online
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
