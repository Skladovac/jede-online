'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { logout } from '@/app/actions/auth'

/** Menu pod přezdívkou v hlavičce: účet, sbírka, sběratelé (na mobilu nejsou v liště) a odhlášení. */
export function UserMenu({ nickname, isAdmin }: { nickname: string; isAdmin: boolean }) {
  const ref = useRef<HTMLDetailsElement>(null)
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

  const item = 'block px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800'
  return (
    <details ref={ref} className="relative">
      <summary className="flex max-w-[8rem] cursor-pointer list-none items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 dark:bg-slate-800">
        <span className="truncate">{nickname}</span>
        <span aria-hidden className="text-xs">▾</span>
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900">
        <Link href="/ucet" className={item}>
          Můj účet
        </Link>
        <Link href="/sbirka" className={item}>
          Moje sbírka
        </Link>
        <Link href={`/u/${encodeURIComponent(nickname)}`} className={item}>
          Můj veřejný profil
        </Link>
        <Link href="/sberatele" className={item}>
          Najdi sběratele
        </Link>
        {isAdmin && (
          <Link href="/admin" className={item}>
            Administrace
          </Link>
        )}
        <form action={logout} className="border-t border-slate-200 dark:border-slate-700">
          <button className={`${item} w-full text-left text-red-600`}>Odhlásit se</button>
        </form>
      </div>
    </details>
  )
}
