'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

/** „Upozornit mě“ u připravované sady (zapnout / vypnout). */
export async function toggleUpcomingWatch(fd: FormData) {
  const user = await getCurrentUser()
  if (!user) return
  const upcomingId = String(fd.get('id') ?? '')
  const set = await prisma.upcomingSet.findUnique({ where: { id: upcomingId }, select: { id: true } })
  if (!set) return
  const key = { userId_upcomingId: { userId: user.id, upcomingId } }
  const exists = await prisma.upcomingSubscription.findUnique({ where: key })
  if (exists) await prisma.upcomingSubscription.delete({ where: key })
  else await prisma.upcomingSubscription.create({ data: { userId: user.id, upcomingId } })
  revalidatePath('/sady/pripravovane')
}
