import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SearchBox } from '@/components/SearchBox'
import { UserMenu } from '@/components/UserMenu'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import { getT } from '@/lib/i18n/server'

export async function SiteHeader() {
  const user = await getCurrentUser()
  const t = await getT()
  // Počet kusů v košíku a nevyřízených příchozích poptávek (odznáček).
  const [cartCount, pendingCount, unreadCount] = user
    ? await Promise.all([
        prisma.tradeRequestItem.count({ where: { request: { fromId: user.id, status: 'DRAFT' }, fromRequester: false } }),
        prisma.tradeRequest.count({ where: { toId: user.id, status: 'PENDING' } }),
        prisma.notification.count({ where: { userId: user.id, readAt: null } }),
      ])
    : [0, 0, 0]
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-4 sm:gap-4">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-bold tracking-tight">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" width={32} height={32} className="h-8 w-8" />
          <span className="hidden sm:inline">pokemon.jede.online</span>
        </Link>
        {/* Na širší obrazovce je hledání v řádku, na mobilu pod ním. */}
        <div className="hidden max-w-md flex-1 md:block">
          <SearchBox />
        </div>
        <nav className="flex shrink-0 items-center gap-2.5 text-sm font-medium sm:gap-4">
          <Link href="/sady" className="hidden hover:text-yellow-600 dark:hover:text-yellow-400 sm:inline">
            {t('Sady')}
          </Link>
          <Link href="/produkty" className="hidden hover:text-yellow-600 dark:hover:text-yellow-400 lg:inline">
            {t('Produkty')}
          </Link>
          <Link href="/trziste" className="hover:text-yellow-600 dark:hover:text-yellow-400">
            {t('Tržiště')}
          </Link>
          {user ? (
            <>
              {/* Na mobilu je Sbírka v menu pod přezdívkou (do lišty se nevejde vedle Tržiště a Výměn). */}
              <Link href="/sbirka" className="hidden hover:text-yellow-600 dark:hover:text-yellow-400 sm:inline">
                {t('Sbírka')}
              </Link>
              <Link href="/sberatele" className="hidden hover:text-yellow-600 dark:hover:text-yellow-400 sm:inline">
                {t('Sběratelé')}
              </Link>
              <Link href="/poptavky" className="relative hover:text-yellow-600 dark:hover:text-yellow-400">
                {t('Výměny')}
                {pendingCount > 0 && <Dot n={pendingCount} />}
              </Link>
              <Link href="/upozorneni" aria-label={t('Upozornění')} className="relative hover:text-yellow-600 dark:hover:text-yellow-400">
                🔔
                {unreadCount > 0 && <Dot n={unreadCount} />}
              </Link>
              <Link href="/kosik" aria-label={t('Košík')} className="relative hover:text-yellow-600 dark:hover:text-yellow-400">
                🛒
                {cartCount > 0 && <Dot n={cartCount} />}
              </Link>
              <LocaleSwitcher />
              <UserMenu nickname={user.nickname} isAdmin={user.isAdmin} />
            </>
          ) : (
            <>
              <LocaleSwitcher />
              <Link href="/prihlaseni" className="hover:text-yellow-600 dark:hover:text-yellow-400">
                {t('Přihlásit')}
              </Link>
              <Link
                href="/registrace"
                className="rounded-full bg-yellow-400 px-3 py-1.5 text-slate-900 hover:bg-yellow-300"
              >
                {t('Registrace')}
              </Link>
            </>
          )}
        </nav>
      </div>
      <div className="px-4 pb-3 md:hidden">
        <SearchBox />
      </div>
    </header>
  )
}

function Dot({ n }: { n: number }) {
  return (
    <span className="absolute -right-3 -top-2 grid h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
      {n}
    </span>
  )
}
