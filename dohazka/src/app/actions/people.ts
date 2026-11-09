'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireCan } from '@/lib/org'
import { rateLimit } from '@/lib/rate-limit'
import { generatePassword, hashPassword } from '@/lib/crypto'
import { parseDayKey, pragueDayKey } from '@/lib/date'
import { createInvitation, notifyAddedToOrg, sendInvitationMail } from '@/lib/invitation'
import { changeMembership, CIZI_CLEN, invalidateForeignPassword } from '@/lib/people'
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
): Promise<{ ok: true; password?: string; invite?: { emailed: boolean; created: true }; existing?: { emailed: boolean } } | { error: string }> {
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
      // relace se zruší a člověk si nové heslo nastaví z pozvánky. Vše v jedné transakci s členstvím.
      const zneplatnit = !!existing && !existing.passwordSetByOwner && (await invalidateForeignPassword(tx, userId, passwordHash))
      const membership = await tx.membership.create({ data: { userId, orgId, role, active: true, tracksFrom }, select: { id: true } })
      // Řádek pozvánky vzniká TADY, v transakci: výpadek databáze nenechá člena bez přihlašovacích údajů a bez pozvánky.
      // Mail se posílá až po potvrzení.
      const posilatPozvanku = existing ? zneplatnit : delivery === 'invite'
      const token = posilatPozvanku ? await createInvitation({ userId, membershipId: membership.id, kind: 'invite' }, tx) : null
      return { duplicate: false as const, created: !existing, userId, membershipId: membership.id, token }
    })
    if (result.duplicate) return { error: JE_VE_FIRME }

    revalidatePath('/firma/lide')
    if (result.token) {
      const { emailed } = await sendInvitationMail({ userId: result.userId, membershipId: result.membershipId, kind: 'invite', token: result.token })
      // Existující účet: správci se nikdy nevrací heslo (zná ho jiný správce) ani nic, podle čeho by poznal, že účet existoval jinde.
      if (!result.created) return { ok: true, existing: { emailed } }
      // Nový účet a e-mail neodešel: vracíme vygenerované heslo, aby správce nezůstal s nedostupným účtem.
      return emailed ? { ok: true, invite: { emailed, created: true } } : { ok: true, password, invite: { emailed: false, created: true } }
    }
    if (!result.created) {
      // Heslo si nastavil majitel sám (nebo si ho nastavil těsně před tímhle voláním): nechává se, jen dostane informaci.
      const emailed = await notifyAddedToOrg(result.userId, ctx.org.name).catch(() => false)
      return { ok: true, existing: { emailed } }
    }
    return { ok: true, password }
  } catch (e) {
    // Souběh dvou přidání téhož e-mailu skončí porušením unikátnosti; nic se nezapsalo.
    console.error('addPerson: přidání selhalo', e instanceof Error ? e.name : 'chyba')
    return { error: 'Člověka se nepodařilo přidat. Zkus to znovu.' }
  }
}

/**
 * Pošle pozvánku znovu (nová pozvánka a nový e-mail). Jen aktivnímu členovi VLASTNÍ firmy: členství se hledá
 * s `orgId` v `where`, takže cizí id se chová jako neexistující a nic se nevytvoří ani neodešle.
 * Slouží jako cesta ven, když první e-mail nedorazil.
 */
export async function resendInvitation(membershipId: string): Promise<{ ok: true; emailed: boolean } | { error: string }> {
  const ctx = await requireCan('managePeople')
  if (typeof membershipId !== 'string' || !membershipId) return { error: 'Neplatný požadavek.' }
  const PRILIS = { error: 'Příliš mnoho pokusů. Zkus to za chvíli.' }
  // Limit na správce (kolik e-mailů rozešle) a na adresáta (stejných 10 za hodinu jako obnova hesla), aby
  // se člověku nedalo zahltit schránku. Adresátův limit se počítá až po ověření, že patří do TÉHLE firmy.
  if (!rateLimit('resend-admin:' + ctx.user.id, 30, 60 * 60_000)) return PRILIS
  try {
    const m = await prisma.membership.findFirst({ where: { id: membershipId, orgId: ctx.org.id, active: true }, select: { id: true, userId: true } })
    if (!m) return { error: CIZI_CLEN }
    if (!rateLimit('resend-user:' + m.userId, 10, 60 * 60_000)) return PRILIS
    const token = await createInvitation({ userId: m.userId, membershipId: m.id, kind: 'invite' })
    const { emailed } = await sendInvitationMail({ userId: m.userId, membershipId: m.id, kind: 'invite', token })
    return { ok: true, emailed }
  } catch (e) {
    console.error('resendInvitation: selhalo', e instanceof Error ? e.name : 'chyba')
    return { error: 'Pozvánku se nepodařilo vytvořit. Zkus to znovu.' }
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
