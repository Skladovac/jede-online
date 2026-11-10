'use server'

import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { ORG_COOKIE } from '@/lib/org'

/**
 * Přepne aktivní firmu. Cookie se zapíše až po ověření, že přihlášený člověk má v dané firmě
 * aktivní členství — nikdy dřív. Vrací, jestli se přepnutí povedlo.
 * Nerevaliduje stránky: volající musí po úspěchu obnovit (router.refresh / revalidatePath).
 * Soubor je samostatný, protože v souboru s 'use server' je každý export veřejná serverová akce.
 */
export async function setActiveOrg(orgId: string): Promise<boolean> {
  if (typeof orgId !== 'string' || !orgId) return false
  const user = await getCurrentUser()
  if (!user) return false
  const membership = await prisma.membership.findFirst({
    where: { userId: user.id, orgId, active: true },
    select: { id: true },
  })
  if (!membership) return false
  ;(await cookies()).set(ORG_COOKIE, orgId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })
  return true
}
