import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { BugReportForm } from '@/components/BugReportForm'
import { InstallApp } from '@/components/InstallApp'

export async function SiteFooter() {
  const user = await getCurrentUser()
  return (
    <footer className="mt-16 border-t border-slate-200 py-8 text-sm text-slate-500 dark:border-slate-800">
      <div className="mx-auto max-w-6xl space-y-2 px-4">
        <p>
          Neoficiální fanouškovský projekt. Pokémon a názvy karet jsou ochranné známky jejich vlastníků (Nintendo, The
          Pokémon Company). Data katalogu: TCGdex.
        </p>
        <div className="flex flex-wrap items-start gap-x-2">
          <a href="/soukromi" className="underline">
            Pravidla a ochrana osobních údajů
          </a>
          <span>·</span>
          <a href="mailto:pokemon@jede.online" className="underline">
            pokemon@jede.online
          </a>
          <span>·</span>
          <BugReportForm loggedIn={!!user} />
          <span>·</span>
          <InstallApp />
          {user?.isAdmin && (
            <>
              <span>·</span>
              <Link href="/admin" className="underline">
                Administrace
              </Link>
            </>
          )}
        </div>
        <p>
          Designed by{' '}
          <a href="https://jede.online" className="font-semibold text-[#C9A961] hover:text-[#D4AF37]">
            jede.online
          </a>
        </p>
      </div>
    </footer>
  )
}
