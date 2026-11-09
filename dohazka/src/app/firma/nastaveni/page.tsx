import type { Metadata } from 'next'
import Link from 'next/link'
import { requireCan } from '@/lib/org'
import { OrgSettingsForm } from './OrgSettingsForm'

export const metadata: Metadata = { title: 'Nastavení firmy' }

export default async function NastaveniFirmyPage() {
  const ctx = await requireCan('manageOrgSettings')
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6">
      <Link href="/nastaveni" className="text-sm text-muted hover:text-fg">
        ← Nastavení
      </Link>
      <h1 className="mt-3 text-xl font-semibold">Nastavení firmy {ctx.org.name}</h1>
      <OrgSettingsForm
        initial={{ reportName: ctx.org.reportName, periodStartDay: ctx.org.periodStartDay, remindHour: ctx.org.remindHour }}
        orgId={ctx.org.id}
      />
    </main>
  )
}
