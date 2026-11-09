'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/org'
import { generatePassword, hashPassword } from '@/lib/crypto'
import { parseDayKey, pragueDayKey } from '@/lib/date'
import { inviteByMail } from '@/lib/invitation'
import { orgSchema, type OrgInput } from '@/lib/validation'

// Tenhle soubor smí exportovat jen serverové akce: každý export je volatelný z prohlížeče.

/**
 * Založí firmu a jejího prvního správce (OWNER) v jedné transakci.
 * - Smí jen super admin; kontrola je první řádek, před čtením vstupu i databáze.
 * - Existující e-mail připojí existujícího člověka (heslo, jméno ani jiná členství se nemění).
 * - U nového účtu vrací vygenerované heslo; zobrazí se jen teď, v databázi zůstane jen hash.
 */
export async function createOrganization(
  input: OrgInput,
): Promise<{ ok: true; orgId: string; password?: string; invite?: { emailed: boolean; created: boolean } } | { error: string }> {
  await requireSuperAdmin()

  const parsed = orgSchema.safeParse(input)
  if (!parsed.success) return { error: 'Zkontroluj prosím údaje: název firmy, název ve výkazu, e-mail a jméno správce.' }
  const { name, reportName, ownerEmail, ownerName, delivery } = parsed.data

  try {
    // Hash se počítá před transakcí: bcrypt je pomalý a transakce se nemá držet otevřená zbytečně.
    // U existujícího účtu se zahodí; heslo se nikdy nepřepisuje.
    // Při pozvánce se heslo nikomu neukazuje: účet dostane náhodné, které nikdo nezná, a heslo si nastaví z e-mailu.
    const password = generatePassword()
    const passwordHash = await hashPassword(password)
    const tracksFrom = parseDayKey(pragueDayKey(new Date()))

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { email: ownerEmail }, select: { id: true } })
      const userId = existing ? existing.id : (await tx.user.create({ data: { email: ownerEmail, name: ownerName, passwordHash } })).id
      const org = await tx.organization.create({ data: { name, reportName }, select: { id: true } })
      // Kolize členství (unique userId+orgId) nemůže nastat: firma je právě vytvořená, její id je čerstvé
      // a žádné jiné členství k ní ještě nepatří.
      const membership = await tx.membership.create({ data: { userId, orgId: org.id, role: 'OWNER', active: true, tracksFrom }, select: { id: true } })
      return { orgId: org.id, created: !existing, userId, membershipId: membership.id }
    })

    revalidatePath('/admin')
    // Nový účet + pozvánka: pozvánka se vytváří až po potvrzení transakce. Firma už existuje, takže selhání
    // pozvánky nebo e-mailu firmu nevrací; admin se to dozví a dostane jiný postup (zapomenuté heslo).
    if (result.created && delivery === 'invite') {
      try {
        const { emailed } = await inviteByMail({ userId: result.userId, membershipId: result.membershipId, kind: 'invite' })
        return { ok: true, orgId: result.orgId, invite: { emailed, created: true } }
      } catch {
        return { ok: true, orgId: result.orgId, invite: { emailed: false, created: false } }
      }
    }
    return result.created ? { ok: true, orgId: result.orgId, password } : { ok: true, orgId: result.orgId }
  } catch {
    // Transakce se vrátila celá: firma bez správce nevznikla. Podrobnosti nepouštíme do prohlížeče.
    return { error: 'Firmu se nepodařilo založit. Zkus to znovu.' }
  }
}
