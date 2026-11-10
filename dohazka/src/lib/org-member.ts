import 'server-only'
import { prisma } from '@/lib/prisma'

/**
 * Jméno člena firmy podle id z adresy, nebo `null`, když v TÉHLE firmě takové členství není.
 * - `orgId` je v `where`: id z cizí firmy se tváří, jako by neexistovalo. Bez něj by stránka historie
 *   vypsala auditní stopu cizí firmy, a protože stránky se netestují, nic by to neshodilo — proto
 *   je hledání tady, v testovatelné funkci, a ne v dotazu uvnitř stránky.
 * - `active` se záměrně nefiltruje: kdo z firmy odešel, má historii změn, kterou je potřeba dohledat
 *   (stejně jako ve výkazech). Izolaci firem drží `orgId`.
 */
export async function findOrgMemberName(orgId: string, membershipId: string): Promise<string | null> {
  const clen = await prisma.membership.findFirst({ where: { id: membershipId, orgId }, select: { user: { select: { name: true } } } })
  return clen?.user.name ?? null
}
