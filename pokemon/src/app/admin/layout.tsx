import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin'

export const metadata: Metadata = { title: 'Administrace', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()
  const [reports, bugs] = await Promise.all([
    prisma.report.count({ where: { resolvedAt: null } }),
    prisma.bugReport.count({ where: { status: 'NEW' } }),
  ])
  const nav: [string, string, number?][] = [
    ['/admin', 'Přehled'],
    ['/admin/uzivatele', 'Uživatelé'],
    ['/admin/nahlaseni', 'Nahlášení', reports],
    ['/admin/chyby', 'Chyby', bugs],
    ['/admin/slova', 'Zakázaná slova'],
  ]
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
        <span className="mr-2 rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-bold uppercase text-white">Admin</span>
        {nav.map(([href, label, n]) => (
          <Link
            key={href}
            href={href}
            className="rounded-full px-3 py-1.5 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {label}
            {!!n && <span className="ml-1.5 rounded-full bg-red-600 px-1.5 text-xs text-white">{n}</span>}
          </Link>
        ))}
      </div>
      {children}
    </main>
  )
}
