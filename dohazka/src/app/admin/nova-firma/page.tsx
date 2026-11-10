import type { Metadata } from 'next'
import { requireSuperAdmin } from '@/lib/org'
import { AdminNav } from '@/components/AdminNav'
import { NewOrgForm } from './NewOrgForm'

export const metadata: Metadata = { title: 'Nová firma' }

// Jen requireSuperAdmin (viz /admin): firmu zakládá i super admin, který zatím žádnou nemá.
export default async function NovaFirmaPage() {
  await requireSuperAdmin()
  return (
    <main className="mx-auto w-full max-w-md px-4 py-6">
      <AdminNav current="nova-firma" />
      <h1 className="text-xl font-semibold">Nová firma</h1>
      <NewOrgForm />
    </main>
  )
}
