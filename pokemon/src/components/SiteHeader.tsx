import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'

export async function SiteHeader() {
  const user = await getCurrentUser()
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-bold tracking-tight">
          <span aria-hidden className="grid h-7 w-7 place-items-center rounded-full bg-yellow-400 text-sm text-slate-900">
            ★
          </span>
          <span className="hidden sm:inline">Pokémon karty</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm font-medium">
          <Link href="/sady" className="hover:text-yellow-600 dark:hover:text-yellow-400">
            Sady
          </Link>
          {user ? (
            <Link href="/ucet" className="rounded-full bg-slate-100 px-3 py-1.5 dark:bg-slate-800">
              {user.nickname}
            </Link>
          ) : (
            <>
              <Link href="/prihlaseni" className="hover:text-yellow-600 dark:hover:text-yellow-400">
                Přihlásit
              </Link>
              <Link
                href="/registrace"
                className="rounded-full bg-yellow-400 px-3 py-1.5 text-slate-900 hover:bg-yellow-300"
              >
                Registrace
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
