import Link from 'next/link'
import type { BugStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin'
import { adminBugStatus } from '@/app/actions/admin'
import { ActionForm } from '@/components/ActionForm'
import { ArrowRight } from 'lucide-react'
import { Badge, EmptyState, panel } from '@/components/design'

const LABEL: Record<BugStatus, string> = { NEW: 'nové', IN_PROGRESS: 'řeší se', DONE: 'hotovo' }
const TONE: Record<BugStatus, 'red' | 'yellow' | 'positive'> = {
  NEW: 'red',
  IN_PROGRESS: 'yellow',
  DONE: 'positive',
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
      <h1 className="text-4xl font-extrabold text-fg sm:text-[44px]">Nahlášené chyby</h1>
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
            className={`inline-flex min-h-9 items-center rounded-full px-3.5 py-1 font-semibold ${(stav ?? '') === k ? 'bg-[var(--ink)] text-white dark:bg-white dark:text-[var(--ink)]' : 'border border-line-strong text-fg hover:bg-card'}`}
          >
            {l}
          </Link>
        ))}
      </div>
      {bugs.length ? (
        <ul className="space-y-3">
          {bugs.map((b) => (
            <li key={b.id} id={b.id} className={`${panel} p-4 text-sm`}>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <Badge tone={TONE[b.status]}>{LABEL[b.status]}</Badge>
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
              <p className="mt-2 whitespace-pre-wrap text-fg">{b.message}</p>
              {b.userAgent && <p className="mt-1 truncate text-xs text-subtle">{b.userAgent}</p>}
              <div className="mt-2 flex gap-3">
                {(['NEW', 'IN_PROGRESS', 'DONE'] as BugStatus[])
                  .filter((s) => s !== b.status)
                  .map((s) => (
                    <ActionForm key={s} action={adminBugStatus}>
                      <input type="hidden" name="bugId" value={b.id} />
                      <input type="hidden" name="status" value={s} />
                      <button className="inline-flex items-center gap-1 text-xs font-semibold text-accent underline underline-offset-4">
                        <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                        {LABEL[s]}
                      </button>
                    </ActionForm>
                  ))}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState>Žádné chyby.</EmptyState>
      )}
    </div>
  )
}
