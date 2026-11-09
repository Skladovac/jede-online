'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireCan } from '@/lib/org'
import { rateLimit } from '@/lib/rate-limit'
import { generatePassword, hashPassword } from '@/lib/crypto'
import { parseDayKey, pragueDayKey } from '@/lib/date'
import { createInvitation, notifyAddedToOrg, sendInvitationMail } from '@/lib/invitation'
import { changeMembership, CIZI_CLEN, invalidateForeignPassword, NEAKTIVNI_CLEN } from '@/lib/people'
import { ROLES } from '@/lib/role'
import { personSchema, type PersonInput } from '@/lib/validation'

// Tenhle soubor smí exportovat jen serverové akce: každý export je volatelný z prohlížeče.
// Pomocné funkce jsou v '@/lib/people'. Lidé se nikdy nemažou, jen deaktivují (Entry má onDelete: Restrict).

const JE_VE_FIRME = 'Tenhle e-mail už ve firmě je. Pokud je neaktivní, znovu ho aktivuj v seznamu.'
const CIZI_UCET =
  'Tenhle e-mail už účet má a heslo mu nastavil někdo jiný. Ať si ho ten člověk nejdřív nastaví sám přes „Zapomenuté heslo“, potom ho půjde přidat.'
const PRILIS = { error: 'Příliš mnoho pokusů. Zkus to za chvíli.' }

/**
 * Přidá člověka do firmy aktivního správce.
 * - Existující e-mail připojí existující účet; heslo, jméno ani jiná členství se nemění.
 * - Účet, kterému heslo nastavil někdo jiný, správce firmy přidat nemůže (CIZI_UCET) — jen super admin.
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
  // Limit na správce (kolik účtů zakládá) a na adresáta, stejně jako u resendInvitation: každé volání na
  // neexistující adresu zakládá účet a posílá e-mail, na existující posílá e-mail cizímu člověku.
  // Adresátův limit se počítá až po kontrole oprávnění, aby ho nešel vyčerpat někdo bez práva spravovat lidi.
  if (!rateLimit('add-admin:' + ctx.user.id, 30, 60 * 60_000)) return PRILIS
  if (!rateLimit('add-user:' + email, 10, 60 * 60_000)) return PRILIS

  try {
    const password = generatePassword()
    const passwordHash = await hashPassword(password)
    const tracksFrom = parseDayKey(pragueDayKey(new Date()))

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { email }, select: { id: true, passwordSetByOwner: true } })
      if (existing) {
        const uz = await tx.membership.findFirst({ where: { userId: existing.id, orgId }, select: { id: true } })
        if (uz) return { ok: false as const, chyba: JE_VE_FIRME }
        // Odmítnutí, ne zneplatnění hesla: účet se hledá JEN podle e-mailu, který napsal volající, takže
        // zneplatnění je zbraň — správce firmy A by podle uhádnutého e-mailu odhlásil a zamkl správce firmy B,
        // který s jeho firmou nemá nic společného. Fail-closed: nic se nezapíše a ten člověk si heslo
        // nastaví sám přes „Zapomenuté heslo“; teprve pak ho jde přidat.
        // Super admin je majitel stroje (zakládá firmy a má i cestu přes CLI), jemu zneplatnění zůstává.
        if (!existing.passwordSetByOwner && !ctx.isSuperAdmin) return { ok: false as const, chyba: CIZI_UCET }
      }
      const userId = existing ? existing.id : (await tx.user.create({ data: { email, name, passwordHash } })).id
      // Účet s heslem, které vygeneroval jiný správce (a zná ho), se připojením do další firmy zneplatní:
      // jinak by se tím heslem dostal tamní správce i do téhle firmy. Heslo se přepíše na náhodné, které nezná nikdo,
      // relace se zruší a člověk si nové heslo nastaví z pozvánky. Vše v jedné transakci s členstvím.
      // Sem se dostane jen super admin: správce firmy je odmítnutý výš.
      const zneplatnit = !!existing && !existing.passwordSetByOwner && (await invalidateForeignPassword(tx, userId, passwordHash))
      const membership = await tx.membership.create({ data: { userId, orgId, role, active: true, tracksFrom }, select: { id: true } })
      // Řádek pozvánky vzniká TADY, v transakci: výpadek databáze nenechá člena bez přihlašovacích údajů a bez pozvánky.
      // Mail se posílá až po potvrzení.
      const posilatPozvanku = existing ? zneplatnit : delivery === 'invite'
      const token = posilatPozvanku ? await createInvitation({ userId, membershipId: membership.id, kind: 'invite' }, tx) : null
      return { ok: true as const, created: !existing, userId, membershipId: membership.id, token }
    })
    if (!result.ok) return { error: result.chyba }

    revalidatePath('/firma/lide')
    if (result.token) {
      const { emailed } = await sendInvitationMail({ userId: result.userId, membershipId: result.membershipId, kind: 'invite', token: result.token })
      // Existující účet: heslo se správci nevrací (zná ho jiný správce). Že ten e-mail už účet má, správce POZNÁ —
      // tvar odpovědi (`existing`) to říká a v seznamu lidí se vypíše uložené jméno toho účtu, ne to, které napsal.
      // Vědomě přijato: správce firmy vzniká jen tím, že mu majitel stroje firmu založí, a schovat to nejde,
      // aniž bychom mu lhali o tom, co se stalo. Nebezpečná část (sáhnutí na cizí heslo) se odmítá výš.
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
  // Limit na správce (kolik e-mailů rozešle) a na adresáta (stejných 10 za hodinu jako obnova hesla), aby
  // se člověku nedalo zahltit schránku. Adresátův limit se počítá až po ověření, že patří do TÉHLE firmy.
  if (!rateLimit('resend-admin:' + ctx.user.id, 30, 60 * 60_000)) return PRILIS
  try {
    // `active` se nefiltruje v dotazu, ale rozhoduje se podle něj: neaktivnímu členovi vlastní firmy
    // patří jiná hláška než cizímu id, jinak by správce hledal chybu u sebe.
    const m = await prisma.membership.findFirst({ where: { id: membershipId, orgId: ctx.org.id }, select: { id: true, userId: true, active: true } })
    if (!m) return { error: CIZI_CLEN }
    if (!m.active) return { error: NEAKTIVNI_CLEN }
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
