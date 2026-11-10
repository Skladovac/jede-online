import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getOrgContext } from '@/lib/org'
import { navLinks } from '@/lib/nav'
import { periodKeyForDay, pragueDayKey } from '@/lib/date'
import { OrgSwitcher } from '@/components/OrgSwitcher'

// Hlavní navigace nad dnem a měsícem. Server komponenta; nahrazuje dřívější jednoodkazový pruh.
// `period` dostane stránka, na které už je (měsíc/den), ať „Měsíc“ vede na totéž období; jinak se bere dnešní.
// Kontext je v rámci požadavku v cache, takže druhý dotaz na něj nic nestojí.
export async function AppNav({ period }: { period?: string }) {
  const ctx = await getOrgContext()
  if (!ctx) return null
  const links = navLinks({
    role: ctx.role,
    isSuperAdmin: ctx.isSuperAdmin,
    period: period ?? periodKeyForDay(ctx.org.periodStartDay, pragueDayKey(new Date())),
  })
  // Přepínač jen při víc než jednom aktivním členství (komponenta sama pro jedno nic nevykreslí).
  const moje = await prisma.membership.findMany({
    where: { userId: ctx.user.id, active: true },
    select: { org: { select: { id: true, name: true } } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  })
  return (
    <div className="mb-3">
      <nav aria-label="Hlavní navigace" className="flex flex-wrap gap-x-1">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="flex min-h-11 items-center px-2 text-sm text-muted hover:text-fg">
            {l.label}
          </Link>
        ))}
      </nav>
      <OrgSwitcher orgs={moje.map((m) => m.org)} currentId={ctx.org.id} />
    </div>
  )
}
