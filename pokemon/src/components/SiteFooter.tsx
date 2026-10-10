import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { BugReportForm } from '@/components/BugReportForm'
import { InstallApp } from '@/components/InstallApp'
import { Pokeball, container } from '@/components/design'
import { getT } from '@/lib/i18n/server'

const link = 'text-[#c9d3e3] transition-colors hover:text-white'

export async function SiteFooter() {
  const user = await getCurrentUser()
  const t = await getT()
  return (
    <footer className="relative mt-24 overflow-hidden bg-[var(--ink)] text-sm text-[#9aa7bd]">
      {/* Jemný Pokéball detail v rohu. */}
      <Pokeball className="pointer-events-none absolute -bottom-24 -right-16 h-72 w-72 text-white opacity-[0.04]" />
      <div className={`${container} relative grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr]`}>
        <div>
          <p className="flex items-center gap-2.5 font-display text-[17px] font-extrabold tracking-tight text-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="" width={28} height={28} className="h-8 w-8 rounded-[9px]" />
            <span>
              pokemon<span className="text-brand-yellow">.jede.online</span>
            </span>
          </p>
          <p className="mt-3 max-w-sm">{t('Fan project · zdarma')}</p>
        </div>
        <div>
          <p className="eyebrow mb-3 !text-[#7d8aa3]">{t('Informace')}</p>
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
          <p className="eyebrow mb-3 !text-[#7d8aa3]">{t('Nástroje')}</p>
          <ul className="space-y-2 text-[#c9d3e3] [&_button]:text-[#c9d3e3] [&_button]:no-underline [&_button:hover]:text-white">
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
      <div className="relative border-t border-[rgba(255,255,255,0.08)]">
        <div className={`${container} flex flex-col gap-2 py-5 text-xs text-[#7d8aa3] sm:flex-row sm:items-center sm:justify-between`}>
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
