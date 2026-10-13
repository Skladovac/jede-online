import { AdminNav } from '@/components/admin/AdminNav'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()
  const newLeads = await prisma.lead.count({ where: { status: 'NEW' } })
  return (
    <>
      <AdminNav name={user.name} newLeads={newLeads} />
      <div className="lg:pl-64">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10 lg:py-12">{children}</div>
      </div>
    </>
  )
}
