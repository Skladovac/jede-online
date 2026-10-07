'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { BugStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin'
import { invalidateBannedWords, normalizeNick } from '@/lib/nickname-filter'
import { NICK_RE, str, type FormState } from '@/lib/validation'

export async function adminRename(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin()
  const id = str(fd, 'userId')
  const nickname = str(fd, 'nickname')
  if (!NICK_RE.test(nickname)) return { error: 'Přezdívka: 3–20 znaků, jen písmena, číslice, _ a -.' }
  const taken = await prisma.user.findFirst({
    where: { nickname: { equals: nickname, mode: 'insensitive' }, id: { not: id } },
  })
  if (taken) return { error: 'Přezdívka je obsazená.' }
  await prisma.user.update({ where: { id }, data: { nickname } })
  revalidatePath(`/admin/uzivatele/${id}`)
  return { ok: 'Přezdívka změněna.' }
}

export async function adminBan(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin()
  const id = str(fd, 'userId')
  if (id === admin.id) return { error: 'Sám sebe zablokovat nejde.' }
  const ban = str(fd, 'ban') === '1'
  await prisma.user.update({ where: { id }, data: { bannedAt: ban ? new Date() : null } })
  // Zablokovaný se okamžitě odhlásí.
  if (ban) {
    await prisma.session.deleteMany({ where: { userId: id } })
    // Otevřené poptávky zablokovaného se zruší (nikdo mu už nesmí poslat kontakt).
    await prisma.tradeRequest.updateMany({
      where: { OR: [{ fromId: id }, { toId: id }], status: { in: ['DRAFT', 'PENDING', 'ACCEPTED'] } },
      data: { status: 'CANCELLED' },
    })
  }
  revalidatePath(`/admin/uzivatele/${id}`)
  return { ok: ban ? 'Účet zablokován a odhlášen.' : 'Účet odblokován.' }
}

export async function adminDelete(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin()
  const id = str(fd, 'userId')
  if (id === admin.id) return { error: 'Svůj vlastní účet smaž přes Můj účet.' }
  const user = await prisma.user.findUnique({ where: { id } })
  if (!user) return { error: 'Uživatel nenalezen.' }
  if (str(fd, 'confirmNick') !== user.nickname) return { error: 'Pro potvrzení opiš přesně přezdívku.' }
  await prisma.user.delete({ where: { id } })
  redirect('/admin/uzivatele?smazano=1')
}

/** Skrytí / zobrazení jedné nabídky (karta nebo produkt). */
export async function adminHideOffer(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin()
  const id = str(fd, 'itemId')
  const hiddenAt = str(fd, 'hide') === '1' ? new Date() : null
  const res =
    str(fd, 'kind') === 'product'
      ? await prisma.productItem.updateMany({ where: { id }, data: { hiddenAt } })
      : await prisma.collectionItem.updateMany({ where: { id }, data: { hiddenAt } })
  if (!res.count) return { error: 'Nabídka nenalezena.' }
  revalidatePath('/admin', 'layout')
  return { ok: hiddenAt ? 'Nabídka skryta.' : 'Nabídka znovu zobrazena.' }
}

/** Skrytí / zobrazení hodnocení (nevhodný komentář, podvodné hodnocení). */
export async function adminHideRating(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin()
  const hiddenAt = str(fd, 'hide') === '1' ? new Date() : null
  const res = await prisma.rating.updateMany({ where: { id: str(fd, 'ratingId') }, data: { hiddenAt } })
  if (!res.count) return { error: 'Hodnocení nenalezeno.' }
  revalidatePath('/admin', 'layout')
  return { ok: hiddenAt ? 'Hodnocení skryto.' : 'Hodnocení znovu zobrazeno.' }
}

export async function adminResolveReport(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin()
  const resolved = str(fd, 'resolved') === '1'
  await prisma.report.update({ where: { id: str(fd, 'reportId') }, data: { resolvedAt: resolved ? new Date() : null } })
  revalidatePath('/admin', 'layout')
  return undefined
}

export async function adminBugStatus(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin()
  const status = str(fd, 'status') as BugStatus
  if (!['NEW', 'IN_PROGRESS', 'DONE'].includes(status)) return { error: 'Neplatný stav.' }
  await prisma.bugReport.update({ where: { id: str(fd, 'bugId') }, data: { status } })
  revalidatePath('/admin/chyby')
  return undefined
}

export async function adminAddWord(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin()
  const word = normalizeNick(str(fd, 'word'))
  if (word.length < 3) return { error: 'Slovo musí mít aspoň 3 písmena (bez diakritiky a čísel).' }
  await prisma.bannedWord.upsert({ where: { word }, create: { word }, update: {} })
  invalidateBannedWords()
  revalidatePath('/admin/slova')
  return { ok: `Přidáno: ${word}` }
}

export async function adminRemoveWord(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin()
  await prisma.bannedWord.deleteMany({ where: { word: str(fd, 'word') } })
  invalidateBannedWords()
  revalidatePath('/admin/slova')
  return undefined
}
