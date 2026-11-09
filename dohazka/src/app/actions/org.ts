'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/org'
import { generatePassword, hashPassword } from '@/lib/crypto'
import { parseDayKey, pragueDayKey } from '@/lib/date'
import { inviteByMail, notifyAddedToOrg } from '@/lib/invitation'
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
      const existing = await tx.user.findUnique({ where: { email: ownerEmail }, select: { id: true, passwordSetByOwner: true } })
      const userId = existing ? existing.id : (await tx.user.create({ data: { email: ownerEmail, name: ownerName, passwordHash } })).id
      // Existující účet s heslem, které vygeneroval (a zná) správce jiné firmy, se tady stane správcem NOVÉ firmy.
      // Heslo se proto zneplatní: přepíše se na náhodné, relace se zruší a správce dostane pozvánku. Jinak by se
      // tím heslem do této firmy dostal správce té druhé, rovnou jako OWNER.
      const zneplatnit = !!existing && !existing.passwordSetByOwner
      if (zneplatnit) {
        await tx.user.update({ where: { id: userId }, data: { passwordHash } })
        await tx.session.deleteMany({ where: { userId } })
      }
      const org = await tx.organization.create({ data: { name, reportName }, select: { id: true } })
      // Kolize členství (unique userId+orgId) nemůže nastat: firma je právě vytvořená, její id je čerstvé
      // a žádné jiné členství k ní ještě nepatří.
      const membership = await tx.membership.create({ data: { userId, orgId: org.id, role: 'OWNER', active: true, tracksFrom }, select: { id: true } })
      return { orgId: org.id, created: !existing, zneplatnit, userId, membershipId: membership.id }
    })

    revalidatePath('/admin')
    // Nový účet + pozvánka: pozvánka se vytváří až po potvrzení transakce. Firma už existuje, takže selhání
    // pozvánky nebo e-mailu firmu nevrací; admin se to dozví a dostane jiný postup (zapomenuté heslo).
    // Existující účet: super adminovi se nikdy nevrací heslo.
    if (!result.created && !result.zneplatnit) {
      // Heslo si nastavil majitel sám: nechává se, jen dostane informační e-mail.
      const emailed = await notifyAddedToOrg(result.userId, name).catch(() => false)
      return { ok: true, orgId: result.orgId, invite: { emailed, created: true } }
    }
    if (!result.created) {
      try {
        const { emailed } = await inviteByMail({ userId: result.userId, membershipId: result.membershipId, kind: 'invite' })
        return { ok: true, orgId: result.orgId, invite: { emailed, created: true } }
      } catch (e) {
        console.error('createOrganization: pozvánku se nepodařilo vytvořit', e instanceof Error ? e.name : 'chyba')
        return { ok: true, orgId: result.orgId, invite: { emailed: false, created: false } }
      }
    }
    if (delivery === 'invite') {
      try {
        const { emailed } = await inviteByMail({ userId: result.userId, membershipId: result.membershipId, kind: 'invite' })
        // E-mail neodešel: správce by jinak zůstal zamčený (heslo nikdo nezná, obnova jde stejným kanálem).
        // Vracíme už vygenerované heslo tohoto účtu, tedy původní chování.
        return emailed
          ? { ok: true, orgId: result.orgId, invite: { emailed, created: true } }
          : { ok: true, orgId: result.orgId, password, invite: { emailed: false, created: true } }
      } catch (e) {
        console.error('createOrganization: pozvánku se nepodařilo vytvořit', e instanceof Error ? e.name : 'chyba')
        return { ok: true, orgId: result.orgId, password, invite: { emailed: false, created: false } }
      }
    }
    return { ok: true, orgId: result.orgId, password }
  } catch (e) {
    console.error('createOrganization: založení firmy selhalo', e instanceof Error ? e.name : 'chyba')
    // Transakce se vrátila celá: firma bez správce nevznikla. Podrobnosti nepouštíme do prohlížeče.
    return { error: 'Firmu se nepodařilo založit. Zkus to znovu.' }
  }
}
