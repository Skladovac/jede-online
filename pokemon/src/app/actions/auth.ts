'use server'

import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import {
  consumeEmailToken,
  createEmailToken,
  createSession,
  destroySession,
  getCurrentUser,
  hashPassword,
  randomToken,
  verifyPassword,
} from '@/lib/auth'
import { needsParentConsent, type CountryCode } from '@/lib/age'
import { sendParentConsentEmail, sendPasswordChangedEmail, sendResetEmail, sendVerifyEmail } from '@/lib/email'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { EMAIL_RE, NICK_RE, checkPassword, checkRegion, safeNext, str, type FormState } from '@/lib/validation'
import { nicknameProblem } from '@/lib/nickname-filter'

export async function register(_: FormState, fd: FormData): Promise<FormState> {
  const fields = Object.fromEntries(
    ['email', 'nickname', 'birthYear', 'birthMonth', 'country', 'region', 'city', 'parentEmail'].map((k) => [k, str(fd, k)]),
  )
  const fail = (error: string): FormState => ({ error, fields })

  if (!rateLimit(`register:${await clientIp()}`, 5, 60 * 60_000)) return fail('Příliš mnoho registrací. Zkus to za hodinu.')

  const email = fields.email.toLowerCase()
  const password = str(fd, 'password')
  const country = fields.country as CountryCode
  const birthYear = Number(fields.birthYear)
  const birthMonth = Number(fields.birthMonth)
  const thisYear = new Date().getFullYear()

  if (!EMAIL_RE.test(email)) return fail('Zadej platný e-mail.')
  if (!NICK_RE.test(fields.nickname)) return fail('Přezdívka: 3–20 znaků, jen písmena, číslice, _ a -.')
  if (await nicknameProblem(fields.nickname)) return fail('Tahle přezdívka není povolená. Zvol prosím jinou.')
  const pwErr = checkPassword(password)
  if (pwErr) return fail(pwErr)
  if (country !== 'CZ' && country !== 'SK') return fail('Vyber zemi.')
  if (!(birthYear >= thisYear - 100 && birthYear <= thisYear - 4) || !(birthMonth >= 1 && birthMonth <= 12))
    return fail('Zadej rok a měsíc narození.')
  if (!checkRegion(country, fields.region)) return fail('Vyber kraj ze seznamu.')
  if (fields.city.length > 60) return fail('Název města je příliš dlouhý.')
  if (fd.get('terms') !== 'on') return fail('Pro registraci je potřeba souhlasit s pravidly a zásadami ochrany údajů.')

  const isMinor = needsParentConsent(birthYear, birthMonth, country)
  const parentEmail = fields.parentEmail.toLowerCase()
  if (isMinor) {
    if (!EMAIL_RE.test(parentEmail)) return fail('Zadej e-mail rodiče — bez jeho souhlasu nebude účet plně fungovat.')
    if (parentEmail === email) return fail('E-mail rodiče musí být jiný než tvůj.')
  }

  const taken = await prisma.user.findFirst({
    where: { OR: [{ email }, { nickname: { equals: fields.nickname, mode: 'insensitive' } }] },
    select: { email: true },
  })
  if (taken) return fail(taken.email === email ? 'Tento e-mail už je zaregistrovaný.' : 'Tahle přezdívka už je obsazená.')

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(password),
      nickname: fields.nickname,
      birthYear,
      birthMonth,
      country,
      region: fields.region || null,
      city: fields.city || null,
      isMinor,
      parentEmail: isMinor ? parentEmail : null,
      parentToken: isMinor ? randomToken() : null,
      // Dospělý rozhoduje o indexaci sám; u dítěte až rodič.
      indexable: !isMinor && fd.get('indexable') === 'on',
      acceptedTermsAt: new Date(),
    },
  })

  const next = safeNext(str(fd, 'next'))
  await sendVerifyEmail(email, user.nickname, await createEmailToken(user.id, 'VERIFY', 72), next)
  if (isMinor && user.parentToken) await sendParentConsentEmail(parentEmail, user.nickname, user.parentToken)

  await createSession(user.id)
  redirect(`/ucet?vitej=1${next ? `&next=${encodeURIComponent(next)}` : ''}`)
}

export async function login(_: FormState, fd: FormData): Promise<FormState> {
  const email = str(fd, 'email').toLowerCase()
  const fail = (error: string): FormState => ({ error, fields: { email } })
  if (!rateLimit(`login:${await clientIp()}`, 10, 15 * 60_000)) return fail('Příliš mnoho pokusů. Zkus to za 15 minut.')

  const user = await prisma.user.findUnique({ where: { email } })
  // Stejná hláška pro neexistující účet i špatné heslo — neprozrazujeme, kdo je registrovaný.
  if (!user || !(await verifyPassword(str(fd, 'password'), user.passwordHash))) return fail('Špatný e-mail nebo heslo.')
  if (user.bannedAt) return fail('Tento účet je zablokovaný.')

  await createSession(user.id)
  const next = str(fd, 'next')
  redirect(safeNext(next) ?? '/') // bez "next" na hlavní stránku
}

export async function logout() {
  await destroySession()
  redirect('/')
}

export async function requestReset(_: FormState, fd: FormData): Promise<FormState> {
  const email = str(fd, 'email').toLowerCase()
  if (!rateLimit(`reset:${await clientIp()}`, 5, 60 * 60_000)) return { error: 'Příliš mnoho žádostí. Zkus to za hodinu.' }
  const user = await prisma.user.findUnique({ where: { email } })
  if (user && !user.bannedAt) await sendResetEmail(email, await createEmailToken(user.id, 'RESET', 1))
  return { ok: 'Pokud je e-mail zaregistrovaný, poslali jsme na něj odkaz pro nové heslo. Když nedorazí, podívej se i do složky Spam / Nevyžádaná pošta.' }
}

export async function resetPassword(_: FormState, fd: FormData): Promise<FormState> {
  const password = str(fd, 'password')
  const pwErr = checkPassword(password)
  if (pwErr) return { error: pwErr }
  const userId = await consumeEmailToken(str(fd, 'token'), 'RESET')
  if (!userId) return { error: 'Odkaz už neplatí. Požádej o nový.' }
  const user = await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(password) } })
  await prisma.session.deleteMany({ where: { userId } }) // odhlásit všude
  await sendPasswordChangedEmail(user.email, user.nickname)
  await createSession(userId)
  redirect('/ucet?heslo=1')
}

export async function resendVerify(): Promise<FormState> {
  const user = await getCurrentUser()
  if (!user || user.emailVerifiedAt) return undefined
  if (!rateLimit(`verify:${user.id}`, 3, 60 * 60_000)) return { error: 'E-mail už jsme poslali. Podívej se i do složky Spam / Nevyžádaná pošta.' }
  await sendVerifyEmail(user.email, user.nickname, await createEmailToken(user.id, 'VERIFY', 72))
  return { ok: 'Poslali jsme nový potvrzovací e-mail. Nevidíš ho? Podívej se i do složky Spam / Nevyžádaná pošta.' }
}

export async function resendParent(): Promise<FormState> {
  const user = await getCurrentUser()
  if (!user?.isMinor || user.parentConsentAt || !user.parentEmail || !user.parentToken) return undefined
  if (!rateLimit(`parent:${user.id}`, 3, 24 * 60 * 60_000)) return { error: 'E-mail rodiči už odešel. Ať se podívá i do složky Spam / Nevyžádaná pošta.' }
  await sendParentConsentEmail(user.parentEmail, user.nickname, user.parentToken)
  return { ok: 'E-mail rodiči jsme poslali znovu. Ať se podívá i do složky Spam / Nevyžádaná pošta.' }
}
