import Link from 'next/link'
import { Coins, Gavel, Tag, type LucideIcon } from 'lucide-react'
import { getT } from '@/lib/i18n/server'

const ITEMS: { id: string; href: string; label: string; icon: LucideIcon }[] = [
  { id: 'nabidky', href: '/trziste', label: 'Nabídky', icon: Tag },
  { id: 'koupim', href: '/trziste?tab=koupim', label: 'Koupím', icon: Coins },
  { id: 'aukce', href: '/aukce', label: 'Aukce', icon: Gavel },
]

/** Záložky tržiště (Nabídky / Koupím / Aukce). `hrefs` = vlastní odkazy (tržiště si přidává filtry). */
export async function MarketNav({ active, hrefs = {} }: { active: string; hrefs?: Record<string, string> }) {
  const t = await getT()
  return (
    <nav className="mt-6 flex gap-2 overflow-x-auto border-b border-line">
      {ITEMS.map((x) => (
        <Link
          key={x.id}
          href={hrefs[x.id] ?? x.href}
          aria-current={x.id === active ? 'page' : undefined}
          className={`-mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 font-semibold transition-colors ${
            x.id === active ? 'border-accent-strong text-fg' : 'border-transparent text-subtle hover:text-fg'
          }`}
        >
          <x.icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          {t(x.label)}
        </Link>
      ))}
    </nav>
  )
}
