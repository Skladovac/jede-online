'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { LOCALE_COOKIE, isLocale } from '@/lib/i18n/config'

/** Přepnutí jazyka vlaječkou: zapamatuje se v prohlížeči (rok) a u účtu (e-maily v tomto jazyce). */
export async function setLocale(locale: string) {
  if (!isLocale(locale)) return
  ;(await cookies()).set(LOCALE_COOKIE, locale, { path: '/', maxAge: 365 * 86_400, sameSite: 'lax' })
  const user = await getCurrentUser()
  if (user) await prisma.user.update({ where: { id: user.id }, data: { locale } })
  revalidatePath('/', 'layout')
}
