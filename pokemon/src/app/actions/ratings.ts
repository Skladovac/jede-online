'use server'

import { revalidatePath } from 'next/cache'
import type { RatingTag } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, isLimited } from '@/lib/auth'
import { APP_URL, esc, notify } from '@/lib/email'
import { rateLimit } from '@/lib/rate-limit'
import { pushNotification } from '@/lib/notifications'
import { textProblem } from '@/lib/nickname-filter'
import { TAG_LABEL } from '@/lib/rating-tags'
import { str, type FormState } from '@/lib/validation'
import { getT, tFor } from '@/lib/i18n/server'

/**
 * Volné hodnocení od registrovaného uživatele (i po obchodu domluveném mimo web).
 * Každý může jednoho uživatele hodnotit jen jednou (pozdější odeslání hodnocení upraví).
 * Hodnocení z dokončené výměny na webu se ukazuje jako ověřené — to dělá rateRequest().
 */
export async function rateUser(_: FormState, fd: FormData): Promise<FormState> {
  const t = await getT()
  const user = await getCurrentUser()
  if (!user) return { error: t('Hodnotit mohou jen přihlášení uživatelé.') }
  if (!user.emailVerifiedAt) return { error: t('Nejdřív potvrď svůj e-mail (odkaz najdeš v Můj účet).') }
  if (isLimited(user) || user.bannedAt) return { error: t('Hodnotit zatím nemůžeš.') }
  if (!rateLimit(`rate:${user.id}`, 10, 24 * 3_600_000)) return { error: t('Dnes už jsi hodnotil(a) hodně lidí. Zkus to zítra.') }

  const to = await prisma.user.findUnique({ where: { id: str(fd, 'toId') } })
  if (!to || to.bannedAt || isLimited(to)) return { error: t('Uživatel nenalezen.') }
  if (to.id === user.id) return { error: t('Sám sebe hodnotit nemůžeš. 🙂') }

  // Kdo už hodnotil po výměně přes web, nepřidává druhé (volné) hodnocení — počítalo by se dvakrát.
  if (await prisma.rating.findFirst({ where: { fromId: user.id, toId: to.id, requestId: { not: null } } }))
    return { error: t('Tohoto uživatele už jsi hodnotil(a) po výměně přes web. Hodnocení upravíš v detailu výměny.') }

  const positive = str(fd, 'positive') === '1'
  const tagRaw = str(fd, 'tag')
  const tag = tagRaw in TAG_LABEL ? (tagRaw as RatingTag) : null
  const comment = str(fd, 'comment').replace(/\s+/g, ' ').trim()
  if (comment.length > 300) return { error: t('Komentář může mít nejvýš 300 znaků.') }
  if (comment && (await textProblem(comment))) return { error: t('Komentář obsahuje nevhodné slovo. Uprav ho prosím.') }

  const data = { positive, tag, comment: comment || null }
  const existing = await prisma.rating.findFirst({ where: { fromId: user.id, toId: to.id, requestId: null } })
  if (existing) await prisma.rating.update({ where: { id: existing.id }, data })
  else {
    await prisma.rating.create({ data: { ...data, fromId: user.id, toId: to.id } })
    const tt = tFor(to.locale)
    await pushNotification(to.id, {
      icon: positive ? '👍' : '👎',
      title: tt('{name} tě ohodnotil(a)', { name: user.nickname }),
      body: comment || undefined,
      url: `/u/${encodeURIComponent(to.nickname)}/hodnoceni`,
    })
    // Upozornit hodnoceného (u dítěte kopie rodiči).
    await notify(
      to.email,
      to.isMinor && to.parentEmail ? [to.parentEmail] : [],
      tt('{name} tě ohodnotil(a) {icon}', { name: user.nickname, icon: positive ? '👍' : '👎' }),
      [
        tt('<strong>{name}</strong> ti dal(a) {kind} hodnocení{tag}.', {
          name: esc(user.nickname),
          kind: positive ? tt('kladné 👍') : tt('záporné 👎'),
          tag: tag ? ` (${tt(TAG_LABEL[tag])})` : '',
        }),
        ...(comment ? [`„${esc(comment)}“`] : []),
      ],
      { label: tt('Zobrazit hodnocení'), url: `${APP_URL}/u/${encodeURIComponent(to.nickname)}/hodnoceni` },
      to.locale,
    )
  }
  revalidatePath(`/u/${encodeURIComponent(to.nickname)}/hodnoceni`)
  return { ok: existing ? t('Hodnocení jsme upravili.') : t('Díky za hodnocení!') }
}
