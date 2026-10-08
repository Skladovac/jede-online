import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { STATUS } from '@/lib/request-status'
import { getT, getLocale } from '@/lib/i18n/server'
import { LOCALE_INFO } from '@/lib/i18n/config'

export async function generateMetadata() {
  const t = await getT()
  return { title: t('Výměny') }
}
export const dynamic = 'force-dynamic'

export default async function RequestsPage() {
  const t = await getT()
  const intl = LOCALE_INFO[await getLocale()].intl
  const user = await getCurrentUser()
  if (!user) redirect('/prihlaseni?next=/poptavky')

  const all = await prisma.tradeRequest.findMany({
    where: { OR: [{ fromId: user.id }, { toId: user.id }], status: { not: 'DRAFT' } },
    include: {
      from: { select: { nickname: true } },
      to: { select: { nickname: true } },
      _count: { select: { items: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 200,
  })
  const incoming = all.filter((r) => r.toId === user.id)
  const outgoing = all.filter((r) => r.fromId === user.id)

  const List = ({ rows, mine }: { rows: typeof all; mine: boolean }) =>
    rows.length ? (
      <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
        {rows.map((r) => (
          <li key={r.id}>
            <Link href={`/poptavky/${r.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <span className="min-w-0 flex-1 font-medium">
                {mine ? t('Pro {name}', { name: r.to.nickname }) : t('Od {name}', { name: r.from.nickname })}
                <span className="text-sm font-normal text-slate-500"> · {r._count.items} {t('položek')}</span>
              </span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS[r.status].cls}`}>
                {t(STATUS[r.status].label)}
              </span>
              <span className="text-xs text-slate-500">{(r.sentAt ?? r.createdAt).toLocaleDateString(intl)}</span>
            </Link>
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-sm text-slate-500">{t('Zatím žádné.')}</p>
    )

  return (
    <main className="mx-auto max-w-3xl space-y-10 px-4 py-10">
      <h1 className="text-3xl font-black tracking-tight">{t('Výměny')}</h1>
      <p className="-mt-6 text-sm text-slate-500">{t('Žádosti o výměnu, koupi nebo dar mezi tebou a ostatními sběrateli.')}</p>
      <section>
        <h2 className="mb-3 text-xl font-bold">{t('Chtějí ode mě')} ({incoming.length})</h2>
        <List rows={incoming} mine={false} />
      </section>
      <section>
        <h2 className="mb-3 text-xl font-bold">{t('Chci od ostatních')} ({outgoing.length})</h2>
        <List rows={outgoing} mine />
      </section>
    </main>
  )
}
