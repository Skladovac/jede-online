'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowDownToLine, BarChart3, ClipboardList, ExternalLink, Home, Inbox, LayoutDashboard, LogOut, MessageSquareQuote, UserRound, Users } from 'lucide-react'
import { logout } from '@/app/actions/admin'
import { LogoMark } from '@/components/Logo'

export function AdminNav({ name, newLeads, questionnaireOpen }: { name: string; newLeads: number; questionnaireOpen: boolean }) {
  const pathname = usePathname()
  const items = [
    { href: '/admin', label: 'Přehled', icon: LayoutDashboard, exact: true },
    { href: '/admin/nemovitosti', label: 'Nemovitosti', icon: Home },
    { href: '/admin/poptavky', label: 'Poptávky', icon: Inbox, badge: newLeads },
    { href: '/admin/dotaznik', label: 'Dotazník', icon: ClipboardList, badge: questionnaireOpen ? 1 : 0 },
    { href: '/admin/reference', label: 'Reference', icon: MessageSquareQuote },
    { href: '/admin/tym', label: 'Tým', icon: Users },
    { href: '/admin/navstevnost', label: 'Návštěvnost', icon: BarChart3 },
    { href: '/admin/realman', label: 'Realman', icon: ArrowDownToLine },
    { href: '/admin/profil', label: 'Můj profil', icon: UserRound },
  ]
  const active = (href: string, exact?: boolean) => (exact ? pathname === href : pathname.startsWith(href))

  return (
    <aside className="sticky top-0 z-40 bg-ink text-paper lg:fixed lg:inset-y-0 lg:left-0 lg:w-64">
      <div className="flex items-center justify-between gap-4 px-5 py-4 lg:block lg:px-6 lg:py-7">
        <Link href="/admin" className="flex items-center gap-3">
          <LogoMark className="h-5 text-paper" />
          <span className="text-[0.68rem] font-semibold uppercase tracking-label text-white/55">Administrace</span>
        </Link>
        <p className="hidden truncate text-sm text-paper/50 lg:mt-6 lg:block">{name}</p>
      </div>
      <nav aria-label="Administrace" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:block lg:space-y-1 lg:px-3">
        {items.map(({ href, label, icon: Icon, exact, badge }) => (
          <Link
            key={href}
            href={href}
            className={`flex shrink-0 items-center gap-3 rounded-[2px] px-3 py-2.5 text-[0.93rem] transition ${
              active(href, exact) ? 'bg-white/10 text-gold-light' : 'text-paper/75 hover:bg-white/5 hover:text-paper'
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
            {!!badge && <span className="ml-auto rounded-full bg-gold px-2 py-0.5 text-xs font-bold text-ink">{badge}</span>}
          </Link>
        ))}
        <div className="hidden border-t border-white/10 pt-3 lg:mt-6 lg:block" />
        <a href="/" target="_blank" className="flex shrink-0 items-center gap-3 rounded-[2px] px-3 py-2.5 text-[0.93rem] text-paper/60 hover:text-paper">
          <ExternalLink className="h-4 w-4" aria-hidden /> Zobrazit web
        </a>
        <form action={logout}>
          <button type="submit" className="flex shrink-0 items-center gap-3 rounded-[2px] px-3 py-2.5 text-[0.93rem] text-paper/60 hover:text-paper">
            <LogOut className="h-4 w-4" aria-hidden /> Odhlásit
          </button>
        </form>
      </nav>
    </aside>
  )
}
