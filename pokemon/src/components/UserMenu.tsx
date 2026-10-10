'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { logout } from '@/app/actions/auth'
import { useT } from '@/lib/i18n/client'
import { ThemeToggle } from '@/components/ThemeToggle'
import { ChevronDown } from 'lucide-react'
import { InstallMenuItem } from '@/components/InstallApp'

/** Menu pod přezdívkou v hlavičce: účet, sbírka, sběratelé (na mobilu nejsou v liště) a odhlášení. */
export function UserMenu({ nickname, isAdmin }: { nickname: string; isAdmin: boolean }) {
  const ref = useRef<HTMLDetailsElement>(null)
  const t = useT()
  const pathname = usePathname()
  // Po přechodu na jinou stránku menu zavřít.
  useEffect(() => {
    if (ref.current) ref.current.open = false
  }, [pathname])
  // Klik mimo menu ho zavře.
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) ref.current.open = false
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  const item = 'block px-4 py-2.5 hover:bg-card-hover'
  return (
    <details ref={ref} className="relative">
      <summary
        aria-label={nickname}
        className="flex min-h-10 max-w-[10rem] cursor-pointer list-none items-center gap-2 rounded-[10px] px-1.5 text-[var(--ink)] transition-colors hover:bg-[rgba(14,27,46,0.08)]"
      >
        {/* Avatar s počátečním písmenem; přezdívka jen na širokém displeji. */}
        <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-[var(--ink)] text-[13px] font-extrabold text-brand-yellow">
          {nickname.slice(0, 1).toUpperCase()}
        </span>
        <span className="hidden truncate font-semibold lg:inline">{nickname}</span>
        <ChevronDown aria-hidden className="h-4 w-4 opacity-70" />
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-[14px] border border-line bg-card py-1.5 text-sm text-fg shadow-[0_2px_4px_rgba(14,27,46,0.05),0_16px_40px_-8px_rgba(14,27,46,0.25)]">
        <Link href="/ucet" className={item}>
          {t('Můj účet')}
        </Link>
        <Link href="/sbirka" className={item}>
          {t('Moje sbírka')}
        </Link>
        <Link href={`/@${encodeURIComponent(nickname)}`} className={item}>
          {t('Můj veřejný profil')}
        </Link>
        <Link href={`/@${encodeURIComponent(nickname)}/hodnoceni`} className={item}>
          {t('Moje hodnocení')}
        </Link>
        <Link href="/sberatele" className={item}>
          {t('Najdi sběratele')}
        </Link>
        <Link href="/trziste" className={item}>
          {t('Tržiště')}
        </Link>
        <Link href="/hodnoceni" className={item}>
          {t('Nejlépe hodnocení')}
        </Link>
        {isAdmin && (
          <Link href="/admin" className={item}>
            {t('Administrace')}
          </Link>
        )}
        <div className="border-t border-line">
          <InstallMenuItem className={item} />
        </div>
        <div className="border-t border-line sm:hidden">
          <ThemeToggle variant="menu" />
        </div>
        <form action={logout} className="border-t border-line">
          <button className={`${item} w-full text-left text-danger`}>{t('Odhlásit se')}</button>
        </form>
      </div>
    </details>
  )
}
