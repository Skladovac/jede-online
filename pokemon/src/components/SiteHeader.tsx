import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SearchBox } from '@/components/SearchBox'
import { UserMenu } from '@/components/UserMenu'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import { ThemeToggle } from '@/components/ThemeToggle'
import { BottomNav } from '@/components/BottomNav'
import { InstallHeaderButton } from '@/components/InstallApp'
import { PushAsk } from '@/components/Push'
import { pushPublicKey } from '@/lib/push'
import { getT } from '@/lib/i18n/server'
import { ArrowLeftRight, Bell, ShoppingBag } from 'lucide-react'

// Odkazy ve žluté hlavičce: inkoustové, při najetí jemná tmavá plocha.
const navLink =
  'inline-flex min-h-10 items-center rounded-[9px] px-3 text-[15px] font-semibold text-[var(--ink)] opacity-85 transition duration-200 hover:bg-[rgba(14,27,46,0.08)] hover:opacity-100'
const iconLink = 'relative inline-flex min-h-10 min-w-10 items-center justify-center rounded-[10px] text-[var(--ink)] transition-colors duration-200 hover:bg-[rgba(14,27,46,0.08)] [&_svg]:h-5 [&_svg]:w-5'

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
      <header className="sticky top-0 z-20 bg-brand-yellow text-[var(--ink)] shadow-[inset_0_-1px_0_rgba(14,27,46,0.14)]">
        <div className="mx-auto flex h-16 max-w-page items-center justify-between gap-3 px-4 sm:px-6 lg:h-[68px]">
          <Link href="/" className="flex shrink-0 items-center gap-2.5 font-display font-extrabold tracking-tight text-[var(--ink)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="" width={34} height={34} className="h-9 w-9 rounded-[10px] shadow-[0_1px_0_rgba(14,27,46,0.25),0_4px_10px_-4px_rgba(14,27,46,0.5)]" />
            <span className="hidden text-[18px] sm:inline">
              pokemon<span className="text-brand-blue-dark">.jede.online</span>
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
                  <ArrowLeftRight strokeWidth={1.75} aria-hidden />
                  {pendingCount > 0 && <Dot n={pendingCount} />}
                </Link>
                <Link href="/upozorneni" aria-label={t('Upozornění')} className={iconLink}>
                  <Bell strokeWidth={1.75} aria-hidden />
                  {unreadCount > 0 && <Dot n={unreadCount} />}
                </Link>
                <Link href="/kosik" aria-label={t('Košík')} className={iconLink}>
                  <ShoppingBag strokeWidth={1.75} aria-hidden />
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
                <InstallHeaderButton className={iconLink} />
                <LocaleSwitcher />
                <ThemeToggle variant="header" />
                {/* Většina návštěv jsou vracející se uživatelé → výrazné je Přihlásit, registrace jako odkaz. */}
                <Link href="/registrace" className={navLink}>
                  {t('Registrovat')}
                </Link>
                <Link
                  href="/prihlaseni"
                  className="ml-1 inline-flex min-h-10 items-center rounded-[10px] bg-[var(--ink)] px-4 font-bold text-white shadow-[0_6px_16px_-6px_rgba(14,27,46,0.55)] transition-colors duration-200 hover:bg-[#1b2c45]"
                >
                  {t('Přihlásit')}
                </Link>
              </>
            )}
          </div>
        </div>
        <div className="px-4 pb-3 md:hidden">
          <SearchBox />
        </div>
      </header>
      {user && pushPublicKey() && <PushAsk publicKey={pushPublicKey()!} />}
      <BottomNav loggedIn={!!user} nickname={user?.nickname} pending={pendingCount} />
    </>
  )
}

function Dot({ n }: { n: number }) {
  return (
    <span className="absolute -right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand-red px-1 text-[10px] font-bold text-white ring-2 ring-brand-yellow">
      {n}
    </span>
  )
}
