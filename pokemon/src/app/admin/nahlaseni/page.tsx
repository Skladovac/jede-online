import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin'
import { adminResolveReport } from '@/app/actions/admin'
import { ActionForm } from '@/components/ActionForm'

export default async function AdminReports({ searchParams }: { searchParams: Promise<{ vse?: string }> }) {
  // Kontrola i na stránce, ne jen v layoutu (Next může layout při částečném vykreslení přeskočit).
  await requireAdmin()
  const all = !!(await searchParams).vse
  const reports = await prisma.report.findMany({
    where: all ? {} : { resolvedAt: null },
    include: { from: { select: { id: true, nickname: true } }, against: { select: { id: true, nickname: true, bannedAt: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between">
        <h1 className="text-3xl font-black tracking-tight">Nahlášení</h1>
        <Link href={all ? '/admin/nahlaseni' : '/admin/nahlaseni?vse=1'} className="text-sm underline">
          {all ? 'Jen otevřená' : 'Zobrazit i vyřízená'}
        </Link>
      </div>
      {reports.length ? (
        <ul className="space-y-3">
          {reports.map((r) => (
            <li
              key={r.id}
              className={`rounded-2xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900 ${r.resolvedAt ? 'opacity-50' : ''}`}
            >
              <p>
                <Link href={`/admin/uzivatele/${r.from.id}`} className="font-semibold hover:underline">
                  {r.from.nickname}
                </Link>{' '}
                nahlásil(a){' '}
                <Link href={`/admin/uzivatele/${r.against.id}`} className="font-semibold text-red-700 hover:underline">
                  {r.against.nickname}
                </Link>
                {r.against.bannedAt && ' (už zablokován)'} · {r.createdAt.toLocaleString('cs-CZ')}
              </p>
              <p className="mt-2 whitespace-pre-wrap">{r.reason}</p>
              <ActionForm action={adminResolveReport} className="mt-2">
                <input type="hidden" name="reportId" value={r.id} />
                <input type="hidden" name="resolved" value={r.resolvedAt ? '0' : '1'} />
                <button className="text-xs underline">{r.resolvedAt ? 'Otevřít znovu' : 'Označit jako vyřízené'}</button>
              </ActionForm>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-slate-500">Nic k vyřízení. 🎉</p>
      )}
    </div>
  )
}
