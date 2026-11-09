'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireCan } from '@/lib/org'
import { generatePassword, hashPassword } from '@/lib/crypto'
import { parseDayKey, pragueDayKey } from '@/lib/date'
import { inviteByMail, notifyAddedToOrg } from '@/lib/invitation'
import { changeMembership } from '@/lib/people'
import { ROLES } from '@/lib/role'
import { personSchema, type PersonInput } from '@/lib/validation'

// Tenhle soubor smí exportovat jen serverové akce: každý export je volatelný z prohlížeče.
// Pomocné funkce jsou v '@/lib/people'. Lidé se nikdy nemažou, jen deaktivují (Entry má onDelete: Restrict).

const JE_VE_FIRME = 'Tenhle e-mail už ve firmě je. Pokud je neaktivní, znovu ho aktivuj v seznamu.'

/**
 * Přidá člověka do firmy aktivního správce.
 * - Existující e-mail připojí existující účet; heslo, jméno ani jiná členství se nemění.
 * - Nový účet: pozvánka e-mailem, nebo vygenerované heslo (zobrazí se jen teď). Když e-mail neodejde,
 *   vrací se heslo, aby správce nezůstal s nedostupným účtem (stejně jako createOrganization).
 */
export async function addPerson(
  input: PersonInput,
): Promise<{ ok: true; password?: string; invite?: { emailed: boolean; created: boolean } } | { error: string }> {
  const ctx = await requireCan('managePeople')
  const orgId = ctx.org.id

  const parsed = personSchema.safeParse(input)
  if (!parsed.success) return { error: 'Zkontroluj prosím e-mail, jméno a roli.' }
  const { email, name, role, delivery } = parsed.data

  try {
    const password = generatePassword()
    const passwordHash = await hashPassword(password)
    const tracksFrom = parseDayKey(pragueDayKey(new Date()))

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { email }, select: { id: true, passwordSetByOwner: true } })
      if (existing) {
        const uz = await tx.membership.findFirst({ where: { userId: existing.id, orgId }, select: { id: true } })
        if (uz) return { duplicate: true as const }
      }
      const userId = existing ? existing.id : (await tx.user.create({ data: { email, name, passwordHash } })).id
      // Účet s heslem, které vygeneroval jiný správce (a zná ho), se připojením do další firmy zneplatní:
      // jinak by se tím heslem dostal tamní správce i do téhle firmy. Heslo se přepíše na náhodné, které nezná nikdo,
      // relace se zruší a člověk si nové heslo nastaví z pozvánky. Totéž v jedné transakci s členstvím.
      const zneplatnit = !!existing && !existing.passwordSetByOwner
      if (zneplatnit) {
        await tx.user.update({ where: { id: userId }, data: { passwordHash } })
        await tx.session.deleteMany({ where: { userId } })
      }
      const membership = await tx.membership.create({ data: { userId, orgId, role, active: true, tracksFrom }, select: { id: true } })
      return { duplicate: false as const, created: !existing, zneplatnit, userId, membershipId: membership.id }
    })
    if (result.duplicate) return { error: JE_VE_FIRME }

    revalidatePath('/firma/lide')
    // Existující účet: správci se nikdy nevrací heslo a nic, podle čeho by poznal, že účet existoval jinde.
    if (!result.created && !result.zneplatnit) {
      // Heslo si nastavil majitel sám: nechává se, jen dostane informační e-mail.
      const emailed = await notifyAddedToOrg(result.userId, ctx.org.name).catch(() => false)
      return { ok: true, invite: { emailed, created: true } }
    }
    if (!result.created || delivery === 'invite') {
      try {
        const { emailed } = await inviteByMail({ userId: result.userId, membershipId: result.membershipId, kind: 'invite' })
        if (emailed) return { ok: true, invite: { emailed, created: true } }
        // U existujícího účtu heslo vracet nelze (je zneplatněné a správce ho nesmí znát); člověk použije „zapomenuté heslo“.
        return result.created ? { ok: true, password, invite: { emailed: false, created: true } } : { ok: true, invite: { emailed: false, created: true } }
      } catch (e) {
        console.error('addPerson: pozvánku se nepodařilo vytvořit', e instanceof Error ? e.name : 'chyba')
        return result.created ? { ok: true, password, invite: { emailed: false, created: false } } : { ok: true, invite: { emailed: false, created: false } }
      }
    }
    return { ok: true, password }
  } catch (e) {
    // Souběh dvou přidání téhož e-mailu skončí porušením unikátnosti; nic se nezapsalo.
    console.error('addPerson: přidání selhalo', e instanceof Error ? e.name : 'chyba')
    return { error: 'Člověka se nepodařilo přidat. Zkus to znovu.' }
  }
}

export async function setRole(membershipId: string, role: string): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireCan('managePeople')
  if (typeof membershipId !== 'string' || !membershipId) return { error: 'Neplatný požadavek.' }
  if (!(ROLES as readonly string[]).includes(role)) return { error: 'Neplatná role.' }
  const r = await changeMembership(ctx.org.id, membershipId, { role: role as (typeof ROLES)[number] })
  if ('ok' in r) revalidatePath('/firma/lide')
  return r
}

export async function setActive(membershipId: string, active: boolean): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireCan('managePeople')
  if (typeof membershipId !== 'string' || !membershipId) return { error: 'Neplatný požadavek.' }
  if (typeof active !== 'boolean') return { error: 'Neplatný požadavek.' }
  const r = await changeMembership(ctx.org.id, membershipId, { active })
  if ('ok' in r) revalidatePath('/firma/lide')
  return r
}
