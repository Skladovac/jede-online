import Link from 'next/link'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin'
import { Ban, Check } from 'lucide-react'
import { inputCls } from '@/components/ui'
import { Badge, btnBlue, panel } from '@/components/design'

const FILTERS: Record<string, { label: string; where: Prisma.UserWhereInput }> = {
  vse: { label: 'Všichni', where: {} },
  deti: { label: 'Děti', where: { isMinor: true } },
  souhlas: { label: 'Čeká na rodiče', where: { isMinor: true, parentConsentAt: null } },
  email: { label: 'Nepotvrzený e-mail', where: { emailVerifiedAt: null } },
  blok: { label: 'Zablokovaní', where: { bannedAt: { not: null } } },
  nahlaseni: { label: 'Nahlášení', where: { reportsAgainst: { some: { resolvedAt: null } } } },
}

export default async function AdminUsers({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filtr?: string; smazano?: string }>
}) {
  // Kontrola i na stránce, ne jen v layoutu (Next může layout při částečném vykreslení přeskočit).
  await requireAdmin()
  const sp = await searchParams
  const q = (sp.q ?? '').trim()
  const filtr = sp.filtr && sp.filtr in FILTERS ? sp.filtr : 'vse'
  const users = await prisma.user.findMany({
    where: {
      ...FILTERS[filtr].where,
      ...(q && {
        OR: [
          { nickname: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { parentEmail: { contains: q, mode: 'insensitive' } },
        ],
      }),
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { _count: { select: { items: true, reportsAgainst: true, sentRequests: true } } },
  })

  return (
    <div className="space-y-5">
      <h1 className="text-4xl font-extrabold text-fg sm:text-[44px]">Uživatelé</h1>
      {sp.smazano && <p role="status" className="rounded-xl bg-[color-mix(in_srgb,var(--positive)_10%,transparent)] px-4 py-2 text-sm text-positive">Účet byl smazán.</p>}
      <form className="flex gap-2">
        <input type="hidden" name="filtr" value={filtr} />
        <input
          name="q"
          defaultValue={q}
          placeholder="Přezdívka nebo e-mail (i rodiče)"
          className={`${inputCls} max-w-md`}
        />
        <button className={btnBlue}>Hledat</button>
      </form>
      <div className="flex flex-wrap gap-2 text-sm">
        {Object.entries(FILTERS).map(([k, f]) => (
          <Link
            key={k}
            href={`/admin/uzivatele?filtr=${k}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
            className={`inline-flex min-h-9 items-center rounded-full px-3.5 py-1 font-semibold ${filtr === k ? 'bg-[var(--ink)] text-white dark:bg-white dark:text-[var(--ink)]' : 'border border-line-strong text-fg hover:bg-card'}`}
          >
            {f.label}
          </Link>
        ))}
      </div>
      <div className={`overflow-x-auto ${panel}`}>
        <table className="w-full text-left text-sm">
          <thead className="eyebrow !text-[10.5px]">
            <tr>
              <th className="px-4 py-2">Přezdívka</th>
              <th className="px-4 py-2">E-mail</th>
              <th className="px-4 py-2">Stav</th>
              <th className="px-4 py-2">Sbírka</th>
              <th className="px-4 py-2">Výměny</th>
              <th className="px-4 py-2">Nahlášení</th>
              <th className="px-4 py-2">Registrace</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-card-hover">
                <td className="px-4 py-2 font-semibold text-fg">
                  <Link href={`/admin/uzivatele/${u.id}`} className="hover:underline">
                    {u.nickname}
                  </Link>
                  {u.isAdmin && (
                    <span className="ml-1.5">
                      <Badge tone="red">admin</Badge>
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-muted">{u.email}</td>
                <td className="px-4 py-2 text-xs">
                  {u.bannedAt || u.isMinor || !u.emailVerifiedAt ? (
                    <span className="flex flex-wrap gap-1">
                      {u.bannedAt && (
                        <Badge tone="red">
                          <Ban strokeWidth={1.75} aria-hidden />
                          zablokován
                        </Badge>
                      )}
                      {u.isMinor &&
                        (u.parentConsentAt ? (
                          <Badge tone="positive">
                            dítě
                            <Check strokeWidth={2} aria-label="souhlas rodiče" />
                          </Badge>
                        ) : (
                          <Badge tone="warning">dítě – čeká</Badge>
                        ))}
                      {!u.emailVerifiedAt && <Badge tone="neutral">e-mail nepotvrzen</Badge>}
                    </span>
                  ) : (
                    <span className="text-muted">OK</span>
                  )}
                </td>
                <td className="px-4 py-2 tabular-nums text-fg">{u._count.items}</td>
                <td className="px-4 py-2 tabular-nums text-fg">{u._count.sentRequests}</td>
                <td className={`px-4 py-2 tabular-nums ${u._count.reportsAgainst ? 'font-bold text-danger' : 'text-fg'}`}>
                  {u._count.reportsAgainst}
                </td>
                <td className="px-4 py-2 tabular-nums text-muted">{u.createdAt.toLocaleDateString('cs-CZ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!users.length && <p className="p-6 text-center text-muted">Nikdo.</p>}
      </div>
    </div>
  )
}
