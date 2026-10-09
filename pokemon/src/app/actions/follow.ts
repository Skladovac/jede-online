'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, isLimited } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { pushNotification } from '@/lib/notifications'
import { str } from '@/lib/validation'
import { tFor } from '@/lib/i18n/server'

/** Sledovat / přestat sledovat sběratele (tlačítko na profilu). */
export async function toggleFollow(fd: FormData) {
  const user = await getCurrentUser()
  const target = await prisma.user.findUnique({ where: { id: str(fd, 'userId') } })
  if (!target) return
  const back = `/u/${encodeURIComponent(target.nickname)}`
  if (!user) redirect(`/prihlaseni?next=${encodeURIComponent(back)}`)
  if (target.id === user.id || target.bannedAt || isLimited(target) || isLimited(user) || user.bannedAt) return

  const key = { followerId_followingId: { followerId: user.id, followingId: target.id } }
  const existing = await prisma.follow.findUnique({ where: key })
  if (existing) await prisma.follow.delete({ where: key })
  else {
    if (!rateLimit(`follow:${user.id}`, 60, 3_600_000)) return
    await prisma.follow.create({ data: { followerId: user.id, followingId: target.id } })
    const tt = tFor(target.locale)
    await pushNotification(target.id, {
      icon: '👀',
      title: tt('{name} tě začal(a) sledovat', { name: user.nickname }),
      url: `/u/${encodeURIComponent(user.nickname)}`,
    })
  }
  revalidatePath(back)
  revalidatePath('/ucet')
}
