'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useT } from '@/lib/i18n/client'

type Item = { href: string; label: string; icon: React.ReactNode; badge?: number; match?: (p: string) => boolean }

const I = {
  home: <path d="M3 11.5 12 4l9 7.5M5.5 9.5V20h13V9.5" />,
  sets: <path d="M4 5h16v14H4zM4 9h16M9 9v10" />,
  market: <path d="M4 7h16l-1.5 11h-13zM8.5 7a3.5 3.5 0 0 1 7 0" />,
  collection: <path d="M7 4h10v16H7zM4 7v10M20 7v10" />,
  trades: <path d="M7 7h11l-3-3M17 17H6l3 3" />,
  account: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.5 7.5 0 0 1 15 0" />,
  join: <path d="M12 5v14M5 12h14" />,
}

/** Spodní lišta na mobilu (ovládání palcem). Na tabletu a desktopu skrytá — tam je navigace v hlavičce. */
export function BottomNav({ loggedIn, nickname, pending = 0 }: { loggedIn: boolean; nickname?: string; pending?: number }) {
  const t = useT()
  const path = usePathname()
  const items: Item[] = loggedIn
    ? [
        { href: '/', label: t('Domů'), icon: I.home, match: (p) => p === '/' },
        { href: '/sbirka', label: t('Sbírka'), icon: I.collection },
        { href: '/trziste', label: t('Tržiště'), icon: I.market },
        { href: '/poptavky', label: t('Výměny'), icon: I.trades, badge: pending },
        {
          href: '/ucet',
          label: t('Účet'),
          icon: I.account,
          match: (p) => p.startsWith('/ucet') || (!!nickname && decodeURIComponent(p).startsWith(`/@${nickname}`)),
        },
      ]
    : [
        { href: '/', label: t('Domů'), icon: I.home, match: (p) => p === '/' },
        { href: '/sady', label: t('Sady'), icon: I.sets },
        { href: '/trziste', label: t('Tržiště'), icon: I.market },
        { href: '/registrace', label: t('Registrace'), icon: I.join, match: (p) => p.startsWith('/registrace') || p.startsWith('/prihlaseni') },
      ]
  return (
    <nav
      aria-label={t('Spodní navigace')}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-[color-mix(in_srgb,var(--bg-primary)_94%,transparent)] pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
    >
      <ul className="flex">
        {items.map((it) => {
          const active = it.match ? it.match(path) : path.startsWith(it.href)
          return (
            <li key={it.href} className="flex-1">
              <Link
                href={it.href}
                aria-current={active ? 'page' : undefined}
                className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors duration-200 ${active ? 'text-accent' : 'text-muted hover:text-fg'}`}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  {it.icon}
                </svg>
                {it.label}
                {!!it.badge && (
                  <span className="absolute right-[calc(50%-18px)] top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                    {it.badge}
                  </span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
