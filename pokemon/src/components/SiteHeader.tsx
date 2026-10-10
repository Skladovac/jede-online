import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SearchBox } from '@/components/SearchBox'
import { UserMenu } from '@/components/UserMenu'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import { ThemeToggle } from '@/components/ThemeToggle'
import { BottomNav } from '@/components/BottomNav'
import { getT } from '@/lib/i18n/server'

// Odkazy v tmavě modré hlavičce: bílé, při najetí žluté podtržení.
const navLink =
  'relative inline-flex min-h-10 items-center rounded-lg px-2.5 font-semibold text-white/85 transition-colors duration-200 hover:text-white after:absolute after:inset-x-2.5 after:bottom-1 after:h-0.5 after:scale-x-0 after:rounded-full after:bg-brand-yellow after:transition-transform after:duration-200 hover:after:scale-x-100'
const iconLink = 'relative inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg text-white/90 hover:bg-white/10'

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
      <header className="sticky top-0 z-20 border-b-[3px] border-brand-yellow bg-brand-blue-dark text-white shadow-md">
        <div className="mx-auto flex h-16 max-w-page items-center justify-between gap-3 px-4 sm:px-6 lg:h-[68px]">
          <Link href="/" className="flex shrink-0 items-center gap-2.5 font-extrabold tracking-tight text-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="" width={34} height={34} className="h-[34px] w-[34px] drop-shadow" />
            <span className="hidden text-[17px] sm:inline">
              pokemon<span className="text-brand-yellow">.jede.online</span>
            </span>
          </Link>

          {/* Hlavní navigace uprostřed (desktop). */}
          <nav className="hidden items-center gap-0.5 text-sm lg:flex" aria-label={t('Hlavní navigace')}>
            {user && (
              <Link href="/sbirka" className={navLink}>
                {t('Sbírka')}
              </Link>
            )}
            <Link href="/sady" className={navLink}>
              {t('Sady')}
            </Link>
            <Link href="/trziste" className={navLink}>
              {t('Tržiště')}
            </Link>
            <Link href={user ? '/sberatele' : '/hodnoceni'} className={navLink}>
              {t('Sběratelé')}
            </Link>
          </nav>

          <div className="flex min-w-0 items-center gap-1 text-sm">
            <div className="hidden w-60 md:block xl:w-72">
              <SearchBox />
            </div>
            {user ? (
              <>
                <Link href="/poptavky" aria-label={t('Výměny')} title={t('Výměny')} className={`${iconLink} hidden sm:inline-flex`}>
                  ⇄{pendingCount > 0 && <Dot n={pendingCount} />}
                </Link>
                <Link href="/upozorneni" aria-label={t('Upozornění')} className={iconLink}>
                  🔔
                  {unreadCount > 0 && <Dot n={unreadCount} />}
                </Link>
                <Link href="/kosik" aria-label={t('Košík')} className={iconLink}>
                  🛒
                  {cartCount > 0 && <Dot n={cartCount} />}
                </Link>
                <LocaleSwitcher />
                <span className="hidden sm:block">
                  <ThemeToggle variant="header" />
                </span>
                <UserMenu nickname={user.nickname} isAdmin={user.isAdmin} />
              </>
            ) : (
              <>
                <LocaleSwitcher />
                <ThemeToggle variant="header" />
                <Link href="/prihlaseni" className={navLink}>
                  {t('Přihlásit')}
                </Link>
                <Link
                  href="/registrace"
                  className="ml-1 inline-flex min-h-10 items-center rounded-[10px] bg-brand-yellow px-3.5 font-bold text-brand-blue-dark transition-colors duration-200 hover:bg-[#f4c000]"
                >
                  {t('Registrovat')}
                </Link>
              </>
            )}
          </div>
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
    <span className="absolute -right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand-red px-1 text-[10px] font-bold text-white ring-2 ring-brand-blue-dark">
      {n}
    </span>
  )
}
