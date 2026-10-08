'use server'

import { cookies } from 'next/headers'
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
  sha256,
  verifyPassword,
} from '@/lib/auth'
import { needsParentConsent, type CountryCode } from '@/lib/age'
import { sendParentConsentEmail, sendPasswordChangedEmail, sendResetEmail, sendVerifyEmail } from '@/lib/email'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { EMAIL_RE, NICK_RE, checkPassword, checkRegion, safeNext, str, type FormState } from '@/lib/validation'
import { nicknameProblem } from '@/lib/nickname-filter'
import { getLocale, getT } from '@/lib/i18n/server'

export async function register(_: FormState, fd: FormData): Promise<FormState> {
  const t = await getT()
  const fields = Object.fromEntries(
    ['email', 'nickname', 'birthYear', 'birthMonth', 'country', 'region', 'city', 'parentEmail'].map((k) => [k, str(fd, k)]),
  )
  const fail = (error: string): FormState => ({ error, fields })

  if (!rateLimit(`register:${await clientIp()}`, 5, 60 * 60_000)) return fail(t('Příliš mnoho registrací. Zkus to za hodinu.'))

  const email = fields.email.toLowerCase()
  const password = str(fd, 'password')
  const country = fields.country as CountryCode
  const birthYear = Number(fields.birthYear)
  const birthMonth = Number(fields.birthMonth)
  const thisYear = new Date().getFullYear()

  if (!EMAIL_RE.test(email)) return fail(t('Zadej platný e-mail.'))
  if (!NICK_RE.test(fields.nickname)) return fail(t('Přezdívka: 3–20 znaků, jen písmena, číslice, _ a -.'))
  if (await nicknameProblem(fields.nickname)) return fail(t('Tahle přezdívka není povolená. Zvol prosím jinou.'))
  const pwErr = checkPassword(password)
  if (pwErr) return fail(t(pwErr))
  if (country !== 'CZ' && country !== 'SK') return fail(t('Vyber zemi.'))
  if (!(birthYear >= thisYear - 100 && birthYear <= thisYear - 4) || !(birthMonth >= 1 && birthMonth <= 12))
    return fail(t('Zadej rok a měsíc narození.'))
  if (!checkRegion(country, fields.region)) return fail(t('Vyber kraj ze seznamu.'))
  if (fields.city.length > 60) return fail(t('Název města je příliš dlouhý.'))
  if (fd.get('terms') !== 'on') return fail(t('Pro registraci je potřeba souhlasit s pravidly a zásadami ochrany údajů.'))

  const isMinor = needsParentConsent(birthYear, birthMonth, country)
  const parentEmail = fields.parentEmail.toLowerCase()
  if (isMinor) {
    if (!EMAIL_RE.test(parentEmail)) return fail(t('Zadej e-mail rodiče — bez jeho souhlasu nebude účet plně fungovat.'))
    if (parentEmail === email) return fail(t('E-mail rodiče musí být jiný než tvůj.'))
  }

  const taken = await prisma.user.findFirst({
    where: { OR: [{ email }, { nickname: { equals: fields.nickname, mode: 'insensitive' } }] },
    select: { email: true },
  })
  if (taken) return fail(taken.email === email ? t('Tento e-mail už je zaregistrovaný.') : t('Tahle přezdívka už je obsazená.'))

  const parentRaw = isMinor ? randomToken() : null
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
      // V DB jen otisk; čistý odkaz jde jen rodiči e-mailem.
      parentToken: parentRaw ? sha256(parentRaw) : null,
      // Dospělý rozhoduje o indexaci sám; u dítěte až rodič.
      indexable: !isMinor && fd.get('indexable') === 'on',
      acceptedTermsAt: new Date(),
      locale: await getLocale(),
    },
  })

  const next = safeNext(str(fd, 'next'))
  await sendVerifyEmail(email, user.nickname, await createEmailToken(user.id, 'VERIFY', 72), next, user.locale)
  if (isMinor && parentRaw) await sendParentConsentEmail(parentEmail, user.nickname, parentRaw, user.locale)

  await createSession(user.id)
  // Nový uživatel na hlavní stránku s průvodcem „Jak začít“ (nebo zpět tam, odkud přišel).
  redirect(next ? `/ucet?vitej=1&next=${encodeURIComponent(next)}` : '/?vitej=1')
}

// bcrypt otisk náhodného hesla — porovnání s ním trvá stejně dlouho jako se skutečným účtem.
const DUMMY_HASH = '$2a$12$6Y6r15t8sijkCjbkYaGFKu9SdMSUsgIoXepIWjD9EBYckCUSkdIrq'

export async function login(_: FormState, fd: FormData): Promise<FormState> {
  const t = await getT()
  const email = str(fd, 'email').toLowerCase()
  const fail = (error: string): FormState => ({ error, fields: { email } })
  if (!rateLimit(`login:${await clientIp()}`, 10, 15 * 60_000)) return fail(t('Příliš mnoho pokusů. Zkus to za 15 minut.'))

  if (!rateLimit(`login-acc:${email}`, 10, 15 * 60_000)) return fail(t('Příliš mnoho pokusů. Zkus to za 15 minut.'))

  const user = await prisma.user.findUnique({ where: { email } })
  // Stejná hláška i stejně dlouhá odpověď pro neexistující účet a špatné heslo — neprozrazujeme, kdo je registrovaný.
  const ok = await verifyPassword(str(fd, 'password'), user?.passwordHash ?? DUMMY_HASH)
  if (!user || !ok) return fail(t('Špatný e-mail nebo heslo.'))
  if (user.bannedAt) return fail(t('Tento účet je zablokovaný.'))

  await createSession(user.id)
  // Jazyk z účtu, pokud si ho v tomhle prohlížeči ještě nevybral.
  const jar = await cookies()
  if (!jar.get('lang') && user.locale) jar.set('lang', user.locale, { path: '/', maxAge: 365 * 86400, sameSite: 'lax' })
  const next = str(fd, 'next')
  redirect(safeNext(next) ?? '/') // bez "next" na hlavní stránku
}

export async function logout() {
  await destroySession()
  redirect('/')
}

export async function requestReset(_: FormState, fd: FormData): Promise<FormState> {
  const t = await getT()
  const email = str(fd, 'email').toLowerCase()
  if (!rateLimit(`reset:${await clientIp()}`, 5, 60 * 60_000) || !rateLimit(`reset-acc:${email}`, 3, 60 * 60_000))
    return { error: t('Příliš mnoho žádostí. Zkus to za hodinu.') }
  const user = await prisma.user.findUnique({ where: { email } })
  if (user && !user.bannedAt) await sendResetEmail(email, await createEmailToken(user.id, 'RESET', 1), user.locale)
  return { ok: t('Pokud je e-mail zaregistrovaný, poslali jsme na něj odkaz pro nové heslo. Když nedorazí, podívej se i do složky Spam / Nevyžádaná pošta.') }
}

export async function resetPassword(_: FormState, fd: FormData): Promise<FormState> {
  const t = await getT()
  const password = str(fd, 'password')
  const pwErr = checkPassword(password)
  if (pwErr) return { error: t(pwErr) }
  const userId = await consumeEmailToken(str(fd, 'token'), 'RESET')
  if (!userId) return { error: t('Odkaz už neplatí. Požádej o nový.') }
  const user = await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(password) } })
  await prisma.session.deleteMany({ where: { userId } }) // odhlásit všude
  await prisma.emailToken.deleteMany({ where: { userId, kind: 'RESET' } }) // ostatní odkazy na obnovu přestanou platit
  await sendPasswordChangedEmail(user.email, user.nickname, user.locale)
  await createSession(userId)
  redirect('/ucet?heslo=1')
}

export async function resendVerify(): Promise<FormState> {
  const t = await getT()
  const user = await getCurrentUser()
  if (!user || user.emailVerifiedAt) return undefined
  if (!rateLimit(`verify:${user.id}`, 3, 60 * 60_000)) return { error: t('E-mail už jsme poslali. Podívej se i do složky Spam / Nevyžádaná pošta.') }
  await sendVerifyEmail(user.email, user.nickname, await createEmailToken(user.id, 'VERIFY', 72), null, user.locale)
  return { ok: t('Poslali jsme nový potvrzovací e-mail. Nevidíš ho? Podívej se i do složky Spam / Nevyžádaná pošta.') }
}

export async function resendParent(): Promise<FormState> {
  const t = await getT()
  const user = await getCurrentUser()
  if (!user?.isMinor || user.parentConsentAt || !user.parentEmail || !user.parentToken) return undefined
  if (!rateLimit(`parent:${user.id}`, 3, 24 * 60 * 60_000)) return { error: t('E-mail rodiči už odešel. Ať se podívá i do složky Spam / Nevyžádaná pošta.') }
  // Nový odkaz (starý přestane platit) — čistý token v DB není, uložený je jen otisk.
  const raw = randomToken()
  await prisma.user.update({ where: { id: user.id }, data: { parentToken: sha256(raw) } })
  await sendParentConsentEmail(user.parentEmail, user.nickname, raw, user.locale)
  return { ok: t('E-mail rodiči jsme poslali znovu. Ať se podívá i do složky Spam / Nevyžádaná pošta.') }
}
