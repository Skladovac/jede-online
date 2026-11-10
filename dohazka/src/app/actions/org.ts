'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireCan, requireSuperAdmin } from '@/lib/org'
import { generatePassword, hashPassword } from '@/lib/crypto'
import { parseDayKey, pragueDayKey } from '@/lib/date'
import { createInvitation, notifyAddedToOrg, sendInvitationMail } from '@/lib/invitation'
import { invalidateForeignPassword } from '@/lib/people'
import { STARA_STRANKA } from '@/lib/stale-page'
import { orgSchema, orgSettingsSchema, type OrgInput, type OrgSettingsInput } from '@/lib/validation'

// Tenhle soubor smí exportovat jen serverové akce: každý export je volatelný z prohlížeče.

/**
 * Založí firmu a jejího prvního správce (OWNER) v jedné transakci.
 * - Smí jen super admin; kontrola je první řádek, před čtením vstupu i databáze.
 * - Existující e-mail připojí existujícího člověka (heslo, jméno ani jiná členství se nemění).
 * - U nového účtu vrací vygenerované heslo; zobrazí se jen teď, v databázi zůstane jen hash.
 */
export async function createOrganization(
  input: OrgInput,
): Promise<{ ok: true; orgId: string; password?: string; invite?: { emailed: boolean; created: true }; existing?: { emailed: boolean } } | { error: string }> {
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
      const zneplatnit = !!existing && !existing.passwordSetByOwner && (await invalidateForeignPassword(tx, userId, passwordHash))
      const org = await tx.organization.create({ data: { name, reportName }, select: { id: true } })
      // Kolize členství (unique userId+orgId) nemůže nastat: firma je právě vytvořená, její id je čerstvé
      // a žádné jiné členství k ní ještě nepatří.
      const membership = await tx.membership.create({ data: { userId, orgId: org.id, role: 'OWNER', active: true, tracksFrom }, select: { id: true } })
      // Řádek pozvánky vzniká v transakci (výpadek nenechá správce bez přístupu a bez pozvánky); mail jde až po potvrzení.
      const posilatPozvanku = existing ? zneplatnit : delivery === 'invite'
      const token = posilatPozvanku ? await createInvitation({ userId, membershipId: membership.id, kind: 'invite' }, tx) : null
      return { orgId: org.id, created: !existing, userId, membershipId: membership.id, token }
    })

    revalidatePath('/admin')
    if (result.token) {
      const { emailed } = await sendInvitationMail({ userId: result.userId, membershipId: result.membershipId, kind: 'invite', token: result.token })
      // Existující účet: super adminovi se nikdy nevrací heslo.
      if (!result.created) return { ok: true, orgId: result.orgId, existing: { emailed } }
      // Nový účet a e-mail neodešel: správce by jinak zůstal zamčený. Vracíme vygenerované heslo tohoto účtu.
      return emailed ? { ok: true, orgId: result.orgId, invite: { emailed, created: true } } : { ok: true, orgId: result.orgId, password, invite: { emailed: false, created: true } }
    }
    if (!result.created) {
      // Heslo si nastavil majitel sám: nechává se, jen dostane informační e-mail.
      const emailed = await notifyAddedToOrg(result.userId, name).catch(() => false)
      return { ok: true, orgId: result.orgId, existing: { emailed } }
    }
    return { ok: true, orgId: result.orgId, password }
  } catch (e) {
    console.error('createOrganization: založení firmy selhalo', e instanceof Error ? e.name : 'chyba')
    // Transakce se vrátila celá: firma bez správce nevznikla. Podrobnosti nepouštíme do prohlížeče.
    return { error: 'Firmu se nepodařilo založit. Zkus to znovu.' }
  }
}

/**
 * Změní nastavení AKTIVNÍ firmy (název ve výkazu, první den období, hodina připomínky).
 * - Kontrola oprávnění je první řádek, před čtením vstupu i databáze.
 * - Id firmy je z kontextu, nikdy ze vstupu; zapisují se jen zparsovaná pole.
 * - `orgId` je firma, pro kterou se stránka vykreslila: slouží JEN k porovnání (zapisuje se pořád do
 *   `ctx.org.id`). Bez toho by formulář z okna, které zůstalo na firmě A, přepsal nastavení firmy B
 *   hodnotami firmy A — a špatný `periodStartDay` potichu přemapuje, které dny patří do kterého
 *   výkazního měsíce, na dokumentu pro mzdy. Proč se chybějící hodnota odmítá: viz '@/lib/stale-page'.
 */
export async function updateOrgSettings(input: OrgSettingsInput, orgId: string): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireCan('manageOrgSettings')
  if (orgId !== ctx.org.id) return { error: STARA_STRANKA }

  const parsed = orgSettingsSchema.safeParse(input)
  if (!parsed.success) return { error: 'Zkontroluj prosím údaje: název ve výkazu, první den období (1–28) a hodinu připomínky (0–23).' }
  const { reportName, periodStartDay, remindHour } = parsed.data

  // Uzávěrka je uložená jako klíč období RRRR-MM. Posun prvního dne období by potichu přemapoval, které dny
  // zamyká, proto se mění jen bez uzávěrek. Nezměněná hodnota projde (uložení ostatních polí musí fungovat).
  if (periodStartDay !== ctx.org.periodStartDay && (await prisma.periodLock.count({ where: { orgId: ctx.org.id } })) > 0) {
    return { error: 'Měsíc je už uzavřený, první den období se proto měnit nedá.' }
  }

  try {
    await prisma.organization.update({ where: { id: ctx.org.id }, data: { reportName, periodStartDay, remindHour } })
  } catch (e) {
    console.error('updateOrgSettings: uložení selhalo', e instanceof Error ? e.name : 'chyba')
    return { error: 'Nastavení se nepodařilo uložit. Zkus to znovu.' }
  }
  revalidatePath('/firma/nastaveni')
  revalidatePath('/mesic', 'layout')
  revalidatePath('/den/[day]', 'page')
  return { ok: true }
}
