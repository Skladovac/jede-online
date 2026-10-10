import Link from 'next/link'
import type { BugStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin'
import { adminBugStatus } from '@/app/actions/admin'
import { ActionForm } from '@/components/ActionForm'

const LABEL: Record<BugStatus, string> = { NEW: 'nové', IN_PROGRESS: 'řeší se', DONE: 'hotovo' }
const CLS: Record<BugStatus, string> = {
  NEW: 'bg-red-100 text-red-800',
  IN_PROGRESS: 'bg-yellow-100 text-fg',
  DONE: 'bg-green-100 text-green-800',
}

export default async function AdminBugs({ searchParams }: { searchParams: Promise<{ stav?: string }> }) {
  // Kontrola i na stránce, ne jen v layoutu (Next může layout při částečném vykreslení přeskočit).
  await requireAdmin()
  const stav = (await searchParams).stav as BugStatus | 'vse' | undefined
  const where = stav === 'vse' ? {} : stav && stav in LABEL ? { status: stav as BugStatus } : { status: { not: 'DONE' as const } }
  const bugs = await prisma.bugReport.findMany({
    where,
    include: { user: { select: { id: true, nickname: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-black tracking-tight">Nahlášené chyby</h1>
      <div className="flex flex-wrap gap-2 text-sm">
        {[
          ['', 'Otevřené'],
          ['NEW', 'Nové'],
          ['IN_PROGRESS', 'Řeší se'],
          ['DONE', 'Hotové'],
          ['vse', 'Vše'],
        ].map(([k, l]) => (
          <Link
            key={k}
            href={`/admin/chyby${k ? `?stav=${k}` : ''}`}
            className={`rounded-full px-3 py-1 ${(stav ?? '') === k ? 'bg-accent-strong text-on-accent' : 'border border-line-strong'}`}
          >
            {l}
          </Link>
        ))}
      </div>
      {bugs.length ? (
        <ul className="space-y-3">
          {bugs.map((b) => (
            <li key={b.id} id={b.id} className="rounded-panel border border-line bg-card p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2 text-xs text-subtle">
                <span className={`rounded-full px-2 py-0.5 font-semibold ${CLS[b.status]}`}>{LABEL[b.status]}</span>
                <span>{b.createdAt.toLocaleString('cs-CZ')}</span>
                <span>
                  ·{' '}
                  {b.user ? (
                    <Link href={`/admin/uzivatele/${b.user.id}`} className="underline">
                      {b.user.nickname}
                    </Link>
                  ) : (
                    'nepřihlášený'
                  )}
                  {b.contact && ` (${b.contact})`}
                </span>
                {b.pageUrl && /^https?:\/\//i.test(b.pageUrl) && (
                  <a href={b.pageUrl} className="truncate underline" target="_blank" rel="noreferrer">
                    {b.pageUrl.replace(/^https?:\/\/[^/]+/, '')}
                  </a>
                )}
              </div>
              <p className="mt-2 whitespace-pre-wrap">{b.message}</p>
              {b.userAgent && <p className="mt-1 truncate text-xs text-subtle">{b.userAgent}</p>}
              <div className="mt-2 flex gap-3">
                {(['NEW', 'IN_PROGRESS', 'DONE'] as BugStatus[])
                  .filter((s) => s !== b.status)
                  .map((s) => (
                    <ActionForm key={s} action={adminBugStatus}>
                      <input type="hidden" name="bugId" value={b.id} />
                      <input type="hidden" name="status" value={s} />
                      <button className="text-xs underline">→ {LABEL[s]}</button>
                    </ActionForm>
                  ))}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-subtle">Žádné chyby. 🎉</p>
      )}
    </div>
  )
}
