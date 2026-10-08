'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

/** Označí všechna upozornění přihlášeného jako přečtená (při otevření stránky upozornění). */
export async function markAllRead() {
  const user = await getCurrentUser()
  if (!user) return
  const res = await prisma.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } })
  if (res.count) revalidatePath('/', 'layout')
}
