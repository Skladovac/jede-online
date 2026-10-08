import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { MarkRead } from '@/components/MarkRead'
import { getT, getLocale } from '@/lib/i18n/server'
import { LOCALE_INFO, type TFunc } from '@/lib/i18n/config'

export async function generateMetadata() {
  const t = await getT()
  return { title: t('Upozornění'), robots: { index: false, follow: false } }
}
export const dynamic = 'force-dynamic'

function ago(d: Date, t: TFunc, intl: string) {
  const min = Math.round((Date.now() - d.getTime()) / 60_000)
  if (min < 1) return t('právě teď')
  if (min < 60) return t('před {n} min', { n: min })
  const h = Math.round(min / 60)
  if (h < 24) return t('před {n} h', { n: h })
  const days = Math.round(h / 24)
  return days === 1 ? t('včera') : days < 7 ? t('před {n} dny', { n: days }) : d.toLocaleDateString(intl)
}

export default async function NotificationsPage() {
  const t = await getT()
  const intl = LOCALE_INFO[await getLocale()].intl
  const user = await getCurrentUser()
  if (!user) redirect('/prihlaseni?next=/upozorneni')
  const list = await prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 50 })
  const unread = list.filter((n) => !n.readAt).length

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-black tracking-tight">{t('Upozornění')}</h1>
      <MarkRead unread={unread} />
      {list.length ? (
        <ul className="mt-6 divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          {list.map((n) => {
            const inner = (
              <div className={`flex gap-3 px-4 py-3 ${n.readAt ? '' : 'bg-yellow-50 dark:bg-yellow-400/10'}`}>
                <span className="text-xl" aria-hidden>
                  {n.icon ?? '🔔'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${n.readAt ? '' : 'font-semibold'}`}>{n.title}</p>
                  {n.body && <p className="truncate text-xs text-slate-500">{n.body}</p>}
                </div>
                <span className="shrink-0 text-xs text-slate-400">{ago(n.createdAt, t, intl)}</span>
              </div>
            )
            return (
              <li key={n.id}>
                {n.url?.startsWith('/') ? (
                  <Link href={n.url} className="block hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="mt-6 text-slate-500">{t('Zatím žádná upozornění. Přijdou sem nové žádosti o výměnu, odpovědi, hodnocení a shody.')}</p>
      )}
      <p className="mt-4 text-xs text-slate-400">{t('Upozornění starší než 90 dní mažeme. E-maily nastavíš v Můj účet.')}</p>
    </main>
  )
}
