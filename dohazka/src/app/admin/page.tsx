import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/org'
import { AdminNav } from '@/components/AdminNav'

export const metadata: Metadata = { title: 'Firmy' }

// Záměrně requireSuperAdmin, ne requireOrgContext: super admin nemusí mít členství v žádné firmě,
// a s firemním kontextem by ho tahle stránka (kde se firmy zakládají) vyřadila.
export default async function AdminPage() {
  await requireSuperAdmin()
  const firmy = await prisma.organization.findMany({
    select: { id: true, name: true, _count: { select: { memberships: { where: { active: true } } } } },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  })
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6">
      <AdminNav current="firmy" />
      <h1 className="text-xl font-semibold">Firmy</h1>
      {firmy.length === 0 ? (
        <p className="mt-4 text-muted">
          Zatím žádná firma.{' '}
          <Link href="/admin/nova-firma" className="underline">
            Založit první
          </Link>
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-line rounded-panel border border-line bg-card">
          {firmy.map((f) => (
            <li key={f.id} className="flex items-baseline justify-between gap-3 px-4 py-3">
              <span className="font-medium">{f.name}</span>
              <span className="text-sm text-muted">aktivních lidí: {f._count.memberships}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
