'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { createSession, destroySession, getCurrentUser, hashPassword, randomToken, sha256, verifyPassword } from '@/lib/auth'
import { sendParentLinksEmail, sendPasswordChangedEmail } from '@/lib/email'
import { rateLimit } from '@/lib/rate-limit'
import { NICK_RE, SOCIAL_FIELDS, checkPassword, checkRegion, parsePhone, parseSocial, str, type FormState } from '@/lib/validation'
import { isAdult } from '@/lib/age'
import { nicknameProblem } from '@/lib/nickname-filter'
import { getT } from '@/lib/i18n/server'

export async function updateProfile(_: FormState, fd: FormData): Promise<FormState> {
  const t = await getT()
  const user = await getCurrentUser()
  if (!user) redirect('/prihlaseni')

  const nickname = str(fd, 'nickname')
  const region = str(fd, 'region')
  const city = str(fd, 'city')
  if (!NICK_RE.test(nickname)) return { error: t('Přezdívka: 3–20 znaků, jen písmena, číslice, _ a -.') }
  if (nickname !== user.nickname && (await nicknameProblem(nickname)))
    return { error: t('Tahle přezdívka není povolená. Zvol prosím jinou.') }
  if (!checkRegion(user.country, region)) return { error: t('Vyber kraj ze seznamu.') }
  if (city.length > 60) return { error: t('Název města je příliš dlouhý.') }
  if (nickname.toLowerCase() !== user.nickname.toLowerCase()) {
    const taken = await prisma.user.findFirst({ where: { nickname: { equals: nickname, mode: 'insensitive' } } })
    if (taken) return { error: t('Tahle přezdívka už je obsazená.') }
  }

  const links: Record<string, string | null> = {}
  for (const f of SOCIAL_FIELDS) {
    const r = parseSocial(f, str(fd, f))
    if ('error' in r) return { error: t(r.error) }
    links[f] = r.url
  }
  // Telefon smí mít jen dospělý.
  const phoneRes = isAdult(user) ? parsePhone(str(fd, 'phone')) : { phone: null }
  if ('error' in phoneRes) return { error: t(phoneRes.error) }

  const linksChanged = SOCIAL_FIELDS.some((f) => links[f] !== user[f])
  const hasLinks = SOCIAL_FIELDS.some((f) => links[f])

  await prisma.user.update({
    where: { id: user.id },
    data: {
      nickname,
      region: region || null,
      city: city || null,
      ...links,
      phone: phoneRes.phone,
      matchEmails: fd.get('matchEmails') === 'on',
      // Dospělý si odkazy schvaluje sám; dítěti je musí znovu schválit rodič.
      ...(linksChanged && { linksApprovedAt: user.isMinor ? null : new Date() }),
      // Indexaci u dítěte řídí jen rodič.
      ...(!user.isMinor && { indexable: fd.get('indexable') === 'on' }),
    },
  })

  if (linksChanged && hasLinks && user.isMinor && user.parentEmail && user.parentToken) {
    // Nový odkaz pro rodiče (v DB je jen otisk původního, ten poslat znovu nejde).
    const raw = randomToken()
    await prisma.user.update({ where: { id: user.id }, data: { parentToken: sha256(raw) } })
    await sendParentLinksEmail(user.parentEmail, nickname, raw, user.locale)
  }

  revalidatePath('/ucet')
  return {
    ok: linksChanged && hasLinks && user.isMinor ? t('Uloženo. Odkazy se zobrazí, až je schválí rodič.') : t('Uloženo.'),
  }
}

/** Změna hesla v Můj účet: staré heslo + nové 2×; ostatní zařízení se odhlásí a přijde upozornění e-mailem. */
export async function changePassword(_: FormState, fd: FormData): Promise<FormState> {
  const t = await getT()
  const user = await getCurrentUser()
  if (!user) redirect('/prihlaseni')
  if (!rateLimit(`pwchange:${user.id}`, 5, 60 * 60_000)) return { error: t('Příliš mnoho pokusů. Zkus to za hodinu.') }
  const current = str(fd, 'current')
  const password = str(fd, 'password')
  if (!(await verifyPassword(current, user.passwordHash))) return { error: t('Současné heslo nesedí.') }
  const pwErr = checkPassword(password)
  if (pwErr) return { error: t(pwErr) }
  if (password !== str(fd, 'password2')) return { error: t('Nová hesla se neshodují.') }
  if (password === current) return { error: t('Nové heslo musí být jiné než současné.') }

  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password) } })
  await prisma.session.deleteMany({ where: { userId: user.id } }) // odhlásit všude…
  await prisma.emailToken.deleteMany({ where: { userId: user.id, kind: 'RESET' } })
  await createSession(user.id) // …kromě tohoto zařízení
  await sendPasswordChangedEmail(user.email, user.nickname, user.locale)
  return { ok: t('Heslo je změněné. Poslali jsme ti o tom e-mail.') }
}

export async function deleteAccount(_: FormState, fd: FormData): Promise<FormState> {
  const t = await getT()
  const user = await getCurrentUser()
  if (!user) redirect('/prihlaseni')
  if (!rateLimit(`delete:${user.id}`, 5, 60 * 60_000)) return { error: t('Příliš mnoho pokusů. Zkus to za hodinu.') }
  if (!(await verifyPassword(str(fd, 'password'), user.passwordHash))) return { error: t('Špatné heslo.') }
  await destroySession()
  await prisma.user.delete({ where: { id: user.id } }) // kaskádou smaže sbírku, relace, tokeny…
  redirect('/?smazano=1')
}
