import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { requireCan } from '@/lib/org'
import { OrgSwitcher } from '@/components/OrgSwitcher'
import { PeopleManager } from './PeopleManager'

export const metadata: Metadata = { title: 'Lidé ve firmě' }

export default async function LidePage() {
  const ctx = await requireCan('managePeople')
  const [clenove, moje] = await Promise.all([
    prisma.membership.findMany({
      where: { orgId: ctx.org.id },
      // Vyjmenovaná pole: hash hesla ani jiné sloupce uživatele se do komponent nedostanou.
      select: { id: true, role: true, active: true, userId: true, user: { select: { name: true, email: true } } },
      orderBy: [{ active: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
    }),
    prisma.membership.findMany({
      where: { userId: ctx.user.id, active: true },
      select: { org: { select: { id: true, name: true } } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
  ])
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6">
      <Link href="/nastaveni" className="text-sm text-muted hover:text-fg">
        ← Nastavení
      </Link>
      <h1 className="mt-3 text-xl font-semibold">Lidé ve firmě {ctx.org.name}</h1>
      <div className="mt-2">
        <OrgSwitcher orgs={moje.map((m) => m.org)} currentId={ctx.org.id} />
      </div>
      <PeopleManager
        lide={clenove.map((m) => ({ id: m.id, name: m.user.name, email: m.user.email, role: m.role, active: m.active, isMe: m.userId === ctx.user.id }))}
        orgId={ctx.org.id}
      />
    </main>
  )
}
