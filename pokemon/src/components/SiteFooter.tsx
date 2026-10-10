import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { BugReportForm } from '@/components/BugReportForm'
import { InstallApp } from '@/components/InstallApp'
import { Pokeball, container } from '@/components/design'
import { getT } from '@/lib/i18n/server'

const link = 'text-white/80 hover:text-white hover:underline'

export async function SiteFooter() {
  const user = await getCurrentUser()
  const t = await getT()
  return (
    <footer className="relative mt-20 overflow-hidden border-t-[3px] border-brand-yellow bg-brand-blue-deep text-sm text-white/75">
      {/* Jemný Pokéball detail v rohu. */}
      <Pokeball className="pointer-events-none absolute -bottom-24 -right-16 h-72 w-72 text-white opacity-[0.05]" />
      <div className={`${container} relative grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr]`}>
        <div>
          <p className="flex items-center gap-2 text-base font-extrabold text-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="" width={28} height={28} className="h-7 w-7" />
            pokemon<span className="-ml-2 text-brand-yellow">.jede.online</span>
          </p>
          <p className="mt-2 max-w-sm">{t('Fan project · zdarma · bez reklam')}</p>
        </div>
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-brand-yellow">{t('Informace')}</p>
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
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-brand-yellow">{t('Nástroje')}</p>
          <ul className="space-y-2 text-white/80 [&_button]:text-white/80 [&_button:hover]:text-white">
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
      <div className="relative border-t border-white/10">
        <div className={`${container} flex flex-col gap-2 py-5 text-xs text-white/60 sm:flex-row sm:items-center sm:justify-between`}>
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
