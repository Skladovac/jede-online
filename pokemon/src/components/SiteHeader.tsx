import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SearchBox } from '@/components/SearchBox'
import { UserMenu } from '@/components/UserMenu'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import { ThemeToggle } from '@/components/ThemeToggle'
import { BottomNav } from '@/components/BottomNav'
import { btnPrimary } from '@/components/design'
import { getT } from '@/lib/i18n/server'

const navLink = 'inline-flex min-h-10 items-center rounded-lg px-2.5 text-muted transition-colors duration-200 hover:bg-card-hover hover:text-fg'

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
    <>
    <header className="sticky top-0 z-20 border-b border-line bg-[color-mix(in_srgb,var(--bg-primary)_88%,transparent)] backdrop-blur">
      <div className="mx-auto flex h-16 max-w-page items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 font-bold tracking-tight text-fg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" width={32} height={32} className="h-8 w-8" />
          <span className="hidden sm:inline">pokemon.jede.online</span>
          <span
            className="hidden rounded-md border border-line-strong px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-muted lg:inline"
            title={t('Zkušební provoz · komunitní projekt ve vývoji, zdarma a bez reklam')}
          >
            BETA
          </span>
        </Link>
        {/* Hledání je hlavní navigace v katalogu: na širší obrazovce uprostřed lišty, na mobilu pod ní. */}
        <div className="hidden max-w-xl flex-1 md:block">
          <SearchBox />
        </div>
        <nav className="flex shrink-0 items-center gap-0.5 text-sm font-medium sm:gap-1" aria-label={t('Hlavní navigace')}>
          {user ? (
            <>
              <Link href="/sady" className={`${navLink} hidden xl:inline-flex`}>
                {t('Sady')}
              </Link>
              <Link href="/trziste" className={`${navLink} hidden sm:inline-flex`}>
                {t('Tržiště')}
              </Link>
              {/* Na mobilu je Sbírka v menu pod přezdívkou (do lišty se nevejde vedle Tržiště a Výměn). */}
              <Link href="/sbirka" className={`${navLink} hidden sm:inline-flex`}>
                {t('Sbírka')}
              </Link>
              <Link href="/sberatele" className={`${navLink} hidden lg:inline-flex`}>
                {t('Sběratelé')}
              </Link>
              <Link href="/poptavky" className={`${navLink} relative hidden sm:inline-flex`}>
                {t('Výměny')}
                {pendingCount > 0 && <Dot n={pendingCount} />}
              </Link>
              <Link href="/upozorneni" aria-label={t('Upozornění')} className={`${navLink} relative`}>
                🔔
                {unreadCount > 0 && <Dot n={unreadCount} />}
              </Link>
              <Link href="/kosik" aria-label={t('Košík')} className={`${navLink} relative`}>
                🛒
                {cartCount > 0 && <Dot n={cartCount} />}
              </Link>
              <LocaleSwitcher />
              <span className="hidden sm:block">
                <ThemeToggle />
              </span>
              <UserMenu nickname={user.nickname} isAdmin={user.isAdmin} />
            </>
          ) : (
            <>
              <Link href="/trziste" className={`${navLink} hidden sm:inline-flex`}>
                {t('Tržiště')}
              </Link>
              <LocaleSwitcher />
              <ThemeToggle />
              <Link href="/prihlaseni" className={navLink}>
                {t('Přihlásit')}
              </Link>
              <Link href="/registrace" className={`${btnPrimary} ml-1 !min-h-10 !px-3.5 !py-1.5 text-sm`}>
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
    <BottomNav loggedIn={!!user} nickname={user?.nickname} pending={pendingCount} />
    </>
  )
}

function Dot({ n }: { n: number }) {
  return (
    <span className="absolute -right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
      {n}
    </span>
  )
}
