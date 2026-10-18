import Link from 'next/link'
import { ArrowRight, CalendarClock } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { daysUntil } from '@/lib/upcoming'
import { getT } from '@/lib/i18n/server'

/** Pruh „Brzy vychází: Delta Reign · za 19 dní“ (úvodní stránka, Sady). Nic, když žádná připravovaná sada není. */
export async function UpcomingBanner({ className = '' }: { className?: string }) {
  const next = await prisma.upcomingSet.findFirst({
    where: { arrivedAt: null, releaseDate: { gt: new Date(Date.now() - 21 * 86_400_000) } },
    orderBy: { releaseDate: 'asc' },
    select: { name: true, code: true, releaseDate: true },
  })
  if (!next) return null
  const t = await getT()
  const days = daysUntil(next.releaseDate)
  const when = days > 1 ? t('za {n} dní', { n: days }) : days === 1 ? t('zítra') : days === 0 ? t('dnes') : t('už vyšla')
  return (
    <Link
      href="/sady/pripravovane"
      className={`group flex items-center gap-3 rounded-[14px] bg-[var(--ink)] px-4 py-3 text-white shadow-soft transition hover:bg-[#1b2c45] dark:bg-card dark:ring-1 dark:ring-line ${className}`}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-brand-yellow text-[var(--ink)]">
        <CalendarClock className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      </span>
      <span className="min-w-0 flex-1 text-sm">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-brand-yellow">{t('Brzy vychází')}</span>
        <span className="block truncate font-semibold">
          {next.name}
          {next.code ? ` (${next.code})` : ''} · {when}
        </span>
      </span>
      <span className="hidden items-center gap-1 text-sm font-semibold text-brand-yellow sm:inline-flex">
        {t('Upozornit mě')}
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </span>
    </Link>
  )
}
