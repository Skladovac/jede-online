'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { createSession, destroySession, getCurrentUser, hashPassword, verifyPassword } from '@/lib/auth'
import { sendParentLinksEmail, sendPasswordChangedEmail } from '@/lib/email'
import { rateLimit } from '@/lib/rate-limit'
import { NICK_RE, SOCIAL_FIELDS, checkPassword, checkRegion, parsePhone, parseSocial, str, type FormState } from '@/lib/validation'
import { isAdult } from '@/lib/age'
import { nicknameProblem } from '@/lib/nickname-filter'

export async function updateProfile(_: FormState, fd: FormData): Promise<FormState> {
  const user = await getCurrentUser()
  if (!user) redirect('/prihlaseni')

  const nickname = str(fd, 'nickname')
  const region = str(fd, 'region')
  const city = str(fd, 'city')
  if (!NICK_RE.test(nickname)) return { error: 'Přezdívka: 3–20 znaků, jen písmena, číslice, _ a -.' }
  if (nickname !== user.nickname && (await nicknameProblem(nickname)))
    return { error: 'Tahle přezdívka není povolená. Zvol prosím jinou.' }
  if (!checkRegion(user.country, region)) return { error: 'Vyber kraj ze seznamu.' }
  if (city.length > 60) return { error: 'Název města je příliš dlouhý.' }
  if (nickname.toLowerCase() !== user.nickname.toLowerCase()) {
    const taken = await prisma.user.findFirst({ where: { nickname: { equals: nickname, mode: 'insensitive' } } })
    if (taken) return { error: 'Tahle přezdívka už je obsazená.' }
  }

  const links: Record<string, string | null> = {}
  for (const f of SOCIAL_FIELDS) {
    const r = parseSocial(f, str(fd, f))
    if ('error' in r) return { error: r.error }
    links[f] = r.url
  }
  // Telefon smí mít jen dospělý.
  const phoneRes = isAdult(user) ? parsePhone(str(fd, 'phone')) : { phone: null }
  if ('error' in phoneRes) return { error: phoneRes.error }

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

  if (linksChanged && hasLinks && user.isMinor && user.parentEmail && user.parentToken)
    await sendParentLinksEmail(user.parentEmail, nickname, user.parentToken)

  revalidatePath('/ucet')
  return {
    ok: linksChanged && hasLinks && user.isMinor ? 'Uloženo. Odkazy se zobrazí, až je schválí rodič.' : 'Uloženo.',
  }
}

/** Změna hesla v Můj účet: staré heslo + nové 2×; ostatní zařízení se odhlásí a přijde upozornění e-mailem. */
export async function changePassword(_: FormState, fd: FormData): Promise<FormState> {
  const user = await getCurrentUser()
  if (!user) redirect('/prihlaseni')
  if (!rateLimit(`pwchange:${user.id}`, 5, 60 * 60_000)) return { error: 'Příliš mnoho pokusů. Zkus to za hodinu.' }
  const current = str(fd, 'current')
  const password = str(fd, 'password')
  if (!(await verifyPassword(current, user.passwordHash))) return { error: 'Současné heslo nesedí.' }
  const pwErr = checkPassword(password)
  if (pwErr) return { error: pwErr }
  if (password !== str(fd, 'password2')) return { error: 'Nová hesla se neshodují.' }
  if (password === current) return { error: 'Nové heslo musí být jiné než současné.' }

  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password) } })
  await prisma.session.deleteMany({ where: { userId: user.id } }) // odhlásit všude…
  await createSession(user.id) // …kromě tohoto zařízení
  await sendPasswordChangedEmail(user.email, user.nickname)
  return { ok: 'Heslo je změněné. Poslali jsme ti o tom e-mail.' }
}

export async function deleteAccount(_: FormState, fd: FormData): Promise<FormState> {
  const user = await getCurrentUser()
  if (!user) redirect('/prihlaseni')
  if (!(await verifyPassword(str(fd, 'password'), user.passwordHash))) return { error: 'Špatné heslo.' }
  await destroySession()
  await prisma.user.delete({ where: { id: user.id } }) // kaskádou smaže sbírku, relace, tokeny…
  redirect('/?smazano=1')
}
