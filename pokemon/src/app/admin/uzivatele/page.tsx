import Link from 'next/link'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin'

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
      <h1 className="text-3xl font-black tracking-tight">Uživatelé</h1>
      {sp.smazano && <p className="rounded-xl bg-green-50 px-4 py-2 text-sm text-green-800">Účet byl smazán.</p>}
      <form className="flex gap-2">
        <input type="hidden" name="filtr" value={filtr} />
        <input
          name="q"
          defaultValue={q}
          placeholder="Přezdívka nebo e-mail (i rodiče)"
          className="w-full max-w-md rounded-full border border-line-strong bg-card px-4 py-2 text-sm"
        />
        <button className="rounded-full bg-accent-strong px-4 py-2 text-sm font-semibold text-on-accent">
          Hledat
        </button>
      </form>
      <div className="flex flex-wrap gap-2 text-sm">
        {Object.entries(FILTERS).map(([k, f]) => (
          <Link
            key={k}
            href={`/admin/uzivatele?filtr=${k}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
            className={`rounded-full px-3 py-1 ${filtr === k ? 'bg-accent-strong text-on-accent' : 'border border-line-strong'}`}
          >
            {f.label}
          </Link>
        ))}
      </div>
      <div className="overflow-x-auto rounded-panel border border-line bg-card">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-subtle">
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
                <td className="px-4 py-2 font-medium">
                  <Link href={`/admin/uzivatele/${u.id}`} className="hover:underline">
                    {u.nickname}
                  </Link>
                  {u.isAdmin && <span className="ml-1 text-xs text-red-600">admin</span>}
                </td>
                <td className="px-4 py-2 text-subtle">{u.email}</td>
                <td className="px-4 py-2 text-xs">
                  {[
                    u.bannedAt && '🚫 zablokován',
                    u.isMinor && (u.parentConsentAt ? 'dítě ✓' : 'dítě – čeká'),
                    !u.emailVerifiedAt && 'e-mail nepotvrzen',
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'OK'}
                </td>
                <td className="px-4 py-2 tabular-nums">{u._count.items}</td>
                <td className="px-4 py-2 tabular-nums">{u._count.sentRequests}</td>
                <td className={`px-4 py-2 tabular-nums ${u._count.reportsAgainst ? 'font-bold text-red-600' : ''}`}>
                  {u._count.reportsAgainst}
                </td>
                <td className="px-4 py-2 text-subtle">{u.createdAt.toLocaleDateString('cs-CZ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!users.length && <p className="p-6 text-center text-subtle">Nikdo.</p>}
      </div>
    </div>
  )
}
