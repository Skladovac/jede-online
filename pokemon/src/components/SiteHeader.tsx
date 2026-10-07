import Link from 'next/link'

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
          <span aria-hidden className="grid h-7 w-7 place-items-center rounded-full bg-yellow-400 text-sm text-slate-900">
            ★
          </span>
          Pokémon karty
        </Link>
        <nav className="flex gap-5 text-sm font-medium">
          <Link href="/sady" className="hover:text-yellow-600 dark:hover:text-yellow-400">
            Sady
          </Link>
        </nav>
      </div>
    </header>
  )
}
