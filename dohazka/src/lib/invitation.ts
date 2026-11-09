import 'server-only'
import { prisma } from '@/lib/prisma'
import { hashPassword, randomToken, sha256 } from '@/lib/crypto'
import { sendMail } from '@/lib/mail'
import { passwordSchema } from '@/lib/validation'

export type InvitationKind = 'invite' | 'reset'

export const INVITATION_HOURS = 48

export const NEPLATNY_ODKAZ = 'Odkaz už neplatí. Požádej o nový.'

/** Základ odkazů v e-mailech. Bez APP_URL výchozí produkční adresa. */
export function appUrl(): string {
  return (process.env.APP_URL?.trim() || 'https://dohazka.jede.online').replace(/\/+$/, '')
}

/**
 * Vytvoří pozvánku nebo odkaz na obnovu hesla a vrátí TOKEN (do odkazu).
 * Do databáze jde jen sha256(token), stejně jako u relací; token samotný nikde nezůstává.
 * Patří uživateli: obnova hesla je věc člověka. `membershipId` je jen volitelný kontext
 * („kam tě zvou“) a u obnovy hesla bývá null.
 * Víc nevyřízených pozvánek jedné osobě je povoleno.
 */
export async function createInvitation(opts: { userId: string; membershipId?: string | null; kind: InvitationKind }): Promise<string> {
  const token = randomToken()
  await prisma.invitation.create({
    data: {
      id: sha256(token),
      userId: opts.userId,
      membershipId: opts.membershipId ?? null,
      kind: opts.kind,
      expiresAt: new Date(Date.now() + INVITATION_HOURS * 3_600_000),
    },
  })
  return token
}

class NeplatnyOdkaz extends Error {}

/**
 * Nastaví heslo z pozvánky / obnovy. Jedna transakce:
 * smaže pozvánku, nastaví heslo a zruší VŠECHNY relace uživatele (změna hesla odhlásí všude).
 * Jednorázovost drží smazání řádku: `deleteMany` s podmínkou id + platnost vrátí počet 1 jen
 * jednomu volajícímu; druhý (i souběžný) dostane 0 a transakce se vrátí, heslo se nezmění.
 */
export async function consumeInvitation(token: string, password: string): Promise<{ ok: true } | { error: string }> {
  const pw = passwordSchema.safeParse(password)
  // Slabé heslo pozvánku nespálí: kontrola je před čtením i mazáním.
  if (!pw.success) return { error: 'Heslo musí mít aspoň 10 znaků.' }
  if (typeof token !== 'string' || token.length < 20 || token.length > 200) return { error: NEPLATNY_ODKAZ }

  const id = sha256(token)
  const inv = await prisma.invitation.findUnique({ where: { id }, select: { userId: true, expiresAt: true } })
  if (!inv) return { error: NEPLATNY_ODKAZ }
  if (inv.expiresAt <= new Date()) {
    await prisma.invitation.deleteMany({ where: { id } }).catch(() => undefined) // prošlý řádek se uklidí
    return { error: NEPLATNY_ODKAZ }
  }

  // Bcrypt je pomalý, proto před transakcí.
  const passwordHash = await hashPassword(pw.data)
  try {
    await prisma.$transaction(async (tx) => {
      const smazano = await tx.invitation.deleteMany({ where: { id, expiresAt: { gt: new Date() } } })
      if (smazano.count !== 1) throw new NeplatnyOdkaz()
      await tx.user.update({ where: { id: inv.userId }, data: { passwordHash } })
      await tx.session.deleteMany({ where: { userId: inv.userId } })
      // Ostatní nevyřízené odkazy téhož člověka už nemají smysl a nesmí zůstat jako zadní vrátka.
      await tx.invitation.deleteMany({ where: { userId: inv.userId } })
    })
  } catch (e) {
    if (e instanceof NeplatnyOdkaz) return { error: NEPLATNY_ODKAZ }
    console.error('consumeInvitation: transakce selhala', e instanceof Error ? e.name : 'chyba')
    return { error: 'Heslo se nepodařilo nastavit. Zkus to znovu.' }
  }
  return { ok: true }
}

/** Co ukázat na stránce odkazu; null = neplatný nebo prošlý. Nic nemění. */
export async function inspectInvitation(token: string) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 200) return null
  const inv = await prisma.invitation.findUnique({
    where: { id: sha256(token) },
    select: {
      kind: true,
      expiresAt: true,
      user: { select: { name: true, email: true } },
      membership: { select: { org: { select: { name: true } } } },
    },
  })
  if (!inv || inv.expiresAt <= new Date()) return null
  return { kind: inv.kind as InvitationKind, name: inv.user.name, email: inv.user.email, orgName: inv.membership?.org.name ?? null }
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Text e-mailu. `orgName` je null u obnovy hesla i u pozvánky, jejíž členství mezitím zmizelo. */
export function invitationMail(kind: InvitationKind, orgName: string | null, link: string) {
  const a = esc(link)
  if (kind === 'reset') {
    return {
      subject: 'Docházka: nastavení nového hesla',
      html: `<p>Dobrý den,</p><p>někdo požádal o nastavení nového hesla k Docházce. Heslo nastavíte tady (odkaz platí ${INVITATION_HOURS} hodin a jde použít jednou):</p><p><a href="${a}">${a}</a></p><p>Pokud jste o to nežádali, e-mail ignorujte, nic se nezmění.</p>`,
    }
  }
  const kam = orgName ? `do firmy <strong>${esc(orgName)}</strong> v Docházce` : 'do Docházky'
  return {
    subject: orgName ? `Docházka: pozvánka do firmy ${orgName}` : 'Docházka: pozvánka',
    html: `<p>Dobrý den,</p><p>byli jste pozváni ${kam}. Heslo si nastavíte tady (odkaz platí ${INVITATION_HOURS} hodin a jde použít jednou):</p><p><a href="${a}">${a}</a></p>`,
  }
}

/**
 * Vytvoří pozvánku a pokusí se ji poslat. Vrací, zda e-mail odešel; pozvánka platí i tak
 * (volající ukáže, že e-mail neodešel). Nevyhazuje kvůli e-mailu, jen kvůli databázi.
 */
export async function inviteByMail(opts: { userId: string; membershipId?: string | null; kind: InvitationKind }): Promise<{ emailed: boolean }> {
  const token = await createInvitation(opts)
  const user = await prisma.user.findUnique({ where: { id: opts.userId }, select: { email: true } })
  if (!user) return { emailed: false }
  let orgName: string | null = null
  if (opts.membershipId) {
    const m = await prisma.membership.findUnique({ where: { id: opts.membershipId }, select: { org: { select: { name: true } } } })
    orgName = m?.org.name ?? null
  }
  const mail = invitationMail(opts.kind, orgName, `${appUrl()}/pozvanka/${token}`)
  return { emailed: await sendMail(user.email, mail.subject, mail.html) }
}
