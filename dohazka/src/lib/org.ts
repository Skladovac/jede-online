import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, requireUser } from '@/lib/auth'
import { pickMembership } from '@/lib/membership'
import { can, type ActionValue } from '@/lib/role'

export const ORG_COOKIE = 'dh_org'

/**
 * Ve které firmě člověk právě pracuje. V rámci požadavku se počítá jednou.
 * - Členství se čtou z databáze jen aktivní a jen vlastní (`userId`), takže cookie `dh_org`
 *   může vybrat jen z toho, co člověk opravdu má; je to klíč pro hledání, ne důvěryhodná hodnota.
 * - Role pochází z `Membership.role` (typ `Role` z Prismy), nikdy z cookie ani z URL.
 * - Bez aktivního členství vrací `null` (deaktivovaný člověk s ještě platnou relací).
 */
export const getOrgContext = cache(async () => {
  const user = await getCurrentUser()
  if (!user) return null
  const memberships = await prisma.membership.findMany({
    where: { userId: user.id, active: true },
    // Vyjmenovaná pole: objekt končí v komponentách, nový sloupec nesmí do prohlížeče bez revize.
    select: {
      id: true,
      orgId: true,
      role: true,
      active: true,
      tracksFrom: true,
      org: { select: { id: true, name: true, reportName: true, periodStartDay: true, remindHour: true } },
    },
    // Úplné uspořádání: createdAt je v Postgresu čas transakce, řádky z jednoho příkazu mají stejný.
    // Záložní „první aktivní členství“ na tom stojí, proto id jako rozhodčí.
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  })
  const wanted = (await cookies()).get(ORG_COOKIE)?.value ?? null
  // `active: true` v dotazu i filtr v pickMembership jsou ÚMYSLNÁ redundance — každá vrstva
  // drží deaktivovaného člověka venku sama. Neodstraňovat při úklidu.
  const membership = pickMembership(memberships, wanted)
  if (!membership) return null
  return { user, membership, org: membership.org, role: membership.role, isSuperAdmin: user.isSuperAdmin }
})

export type OrgContext = NonNullable<Awaited<ReturnType<typeof getOrgContext>>>

// POZOR: všechny `require*` fungují vyhozením NEXT_REDIRECT. `await requireCan(...)` zabalené
// do try/catch tu výjimku spolkne a kontrolu tiše vypne — nikdy je nebalit.

/**
 * Kontext firmy. Nepřihlášený jde na přihlášení; přihlášený bez aktivního členství na
 * /bez-pristupu (přihlašovací stránka by ho poslala zpátky na `/` a vznikla by smyčka).
 */
export async function requireOrgContext(): Promise<OrgContext> {
  const ctx = await getOrgContext()
  if (ctx) return ctx
  if (await getCurrentUser()) redirect('/bez-pristupu')
  redirect('/prihlaseni')
}

/** Kontext firmy, a to jen pokud smí danou akci; jinak přesměruje na úvod. */
export async function requireCan(action: ActionValue): Promise<OrgContext> {
  const ctx = await requireOrgContext()
  if (!can(ctx.role, action, ctx.isSuperAdmin)) redirect('/')
  return ctx
}

/**
 * Jen super admin. Příznak je na uživateli, ne v roli firmy, a funguje napříč firmami,
 * proto nevyžaduje firemní kontext a vrací uživatele. Firmu si volající případně vezme z `getOrgContext()`.
 */
export async function requireSuperAdmin() {
  const user = await requireUser()
  if (!user.isSuperAdmin) redirect('/')
  return user
}
