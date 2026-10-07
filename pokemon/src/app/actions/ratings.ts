'use server'

import { revalidatePath } from 'next/cache'
import type { RatingTag } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, isLimited } from '@/lib/auth'
import { APP_URL, esc, notify } from '@/lib/email'
import { rateLimit } from '@/lib/rate-limit'
import { textProblem } from '@/lib/nickname-filter'
import { TAG_LABEL } from '@/lib/rating-tags'
import { str, type FormState } from '@/lib/validation'

/**
 * Volné hodnocení od registrovaného uživatele (i po obchodu domluveném mimo web).
 * Každý může jednoho uživatele hodnotit jen jednou (pozdější odeslání hodnocení upraví).
 * Hodnocení z dokončené výměny na webu se ukazuje jako ověřené — to dělá rateRequest().
 */
export async function rateUser(_: FormState, fd: FormData): Promise<FormState> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Hodnotit mohou jen přihlášení uživatelé.' }
  if (!user.emailVerifiedAt) return { error: 'Nejdřív potvrď svůj e-mail (odkaz najdeš v Můj účet).' }
  if (isLimited(user) || user.bannedAt) return { error: 'Hodnotit zatím nemůžeš.' }
  if (!rateLimit(`rate:${user.id}`, 10, 24 * 3_600_000)) return { error: 'Dnes už jsi hodnotil(a) hodně lidí. Zkus to zítra.' }

  const to = await prisma.user.findUnique({ where: { id: str(fd, 'toId') } })
  if (!to || to.bannedAt || isLimited(to)) return { error: 'Uživatel nenalezen.' }
  if (to.id === user.id) return { error: 'Sám sebe hodnotit nemůžeš. 🙂' }

  // Kdo už hodnotil po výměně přes web, nepřidává druhé (volné) hodnocení — počítalo by se dvakrát.
  if (await prisma.rating.findFirst({ where: { fromId: user.id, toId: to.id, requestId: { not: null } } }))
    return { error: 'Tohoto uživatele už jsi hodnotil(a) po výměně přes web. Hodnocení upravíš v detailu poptávky.' }

  const positive = str(fd, 'positive') === '1'
  const tagRaw = str(fd, 'tag')
  const tag = tagRaw in TAG_LABEL ? (tagRaw as RatingTag) : null
  const comment = str(fd, 'comment').replace(/\s+/g, ' ').trim()
  if (comment.length > 300) return { error: 'Komentář může mít nejvýš 300 znaků.' }
  if (comment && (await textProblem(comment))) return { error: 'Komentář obsahuje nevhodné slovo. Uprav ho prosím.' }

  const data = { positive, tag, comment: comment || null }
  const existing = await prisma.rating.findFirst({ where: { fromId: user.id, toId: to.id, requestId: null } })
  if (existing) await prisma.rating.update({ where: { id: existing.id }, data })
  else {
    await prisma.rating.create({ data: { ...data, fromId: user.id, toId: to.id } })
    // Upozornit hodnoceného (u dítěte kopie rodiči).
    await notify(
      to.email,
      to.isMinor && to.parentEmail ? [to.parentEmail] : [],
      `${user.nickname} tě ohodnotil(a) ${positive ? '👍' : '👎'}`,
      [
        `<strong>${esc(user.nickname)}</strong> ti dal(a) ${positive ? 'kladné 👍' : 'záporné 👎'} hodnocení${tag ? ` (${TAG_LABEL[tag]})` : ''}.`,
        ...(comment ? [`„${esc(comment)}“`] : []),
      ],
      { label: 'Zobrazit hodnocení', url: `${APP_URL}/u/${encodeURIComponent(to.nickname)}/hodnoceni` },
    )
  }
  revalidatePath(`/u/${encodeURIComponent(to.nickname)}/hodnoceni`)
  return { ok: existing ? 'Hodnocení jsme upravili.' : 'Díky za hodnocení!' }
}
