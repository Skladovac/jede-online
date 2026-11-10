import 'server-only'
import { prisma } from '@/lib/prisma'
import type { RoleValue } from '@/lib/role'

// Pomocné funkce správy lidí. Mimo 'use server' soubor, aby je nešlo volat z prohlížeče.

export type Zmena = { role: RoleValue } | { active: boolean }

export const CIZI_CLEN = 'Tenhle člověk ve vaší firmě není.'
// Samostatná hláška: CIZI_CLEN patří cizímu id, tohle neaktivnímu členovi vlastní firmy — ten ve firmě je.
export const NEAKTIVNI_CLEN = 'Tenhle člověk je ve firmě neaktivní. Nejdřív ho v seznamu aktivuj, potom mu pozvánka půjde poslat.'
export const POSLEDNI_SPRAVCE = 'Firma musí mít aspoň jednoho aktivního správce. Nejdřív jmenuj jiného.'

class Odmitnuto extends Error {}

/**
 * Zneplatní heslo účtu, které vygeneroval (a tedy zná) někdo jiný než jeho majitel. Volá se uvnitř transakce
 * při připojení EXISTUJÍCÍHO účtu do další firmy. `updateMany` s podmínkou `passwordSetByOwner: false`
 * je zámek proti souběhu: když si majitel mezitím nastavil vlastní heslo z pozvánky, nic se nepřepíše
 * (count 0) a volající pošle jen informační e-mail. Vrací, zda se heslo opravdu zneplatnilo.
 * Relace se ruší jen při zneplatnění.
 */
export async function invalidateForeignPassword(
  tx: Pick<typeof prisma, 'user' | 'session'>,
  userId: string,
  passwordHash: string,
): Promise<boolean> {
  const r = await tx.user.updateMany({ where: { id: userId, passwordSetByOwner: false }, data: { passwordHash } })
  if (r.count !== 1) return false
  await tx.session.deleteMany({ where: { userId } })
  return true
}

/**
 * Změní roli nebo aktivitu členství JEN v rámci firmy `orgId`.
 * - Členství se hledá s `orgId` v `where`, takže cizí id se chová jako neexistující a nic se nezapíše.
 * - Zápis jde přes `updateMany` s `orgId` znovu v `where` (druhá vrstva, kdyby se řádek mezitím přesunul).
 * - Poslední aktivní OWNER se nesmí deaktivovat ani přeřadit. Kontrola a zápis jsou v jedné
 *   serializovatelné transakci, aby dva správci souběžně neodstranili jeden druhého.
 */
export async function changeMembership(orgId: string, membershipId: string, zmena: Zmena): Promise<{ ok: true } | { error: string }> {
  try {
    await prisma.$transaction(
      async (tx) => {
        const cil = await tx.membership.findFirst({ where: { id: membershipId, orgId }, select: { id: true, role: true, active: true } })
        if (!cil) throw new Odmitnuto(CIZI_CLEN)

        const odebiraSpravce =
          cil.role === 'OWNER' && cil.active && (('role' in zmena && zmena.role !== 'OWNER') || ('active' in zmena && !zmena.active))
        if (odebiraSpravce) {
          const jini = await tx.membership.count({ where: { orgId, role: 'OWNER', active: true, id: { not: cil.id } } })
          if (jini === 0) throw new Odmitnuto(POSLEDNI_SPRAVCE)
        }

        const data = 'role' in zmena ? { role: zmena.role } : { active: zmena.active }
        const r = await tx.membership.updateMany({ where: { id: cil.id, orgId }, data })
        if (r.count !== 1) throw new Odmitnuto(CIZI_CLEN)
      },
      { isolationLevel: 'Serializable' },
    )
    return { ok: true }
  } catch (e) {
    if (e instanceof Odmitnuto) return { error: e.message }
    console.error('changeMembership: zápis selhal', e instanceof Error ? e.name : 'chyba')
    return { error: 'Změnu se nepodařilo uložit. Zkus to znovu.' }
  }
}
