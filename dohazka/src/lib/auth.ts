import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { randomToken, sha256 } from '@/lib/crypto'

// Zbytek aplikace importuje z '@/lib/auth'; čisté funkce žijí v '@/lib/crypto'.
export { hashPassword, randomToken, verifyPassword } from '@/lib/crypto'

const COOKIE = 'dh_session'
const SESSION_DAYS = 30

/** Pole uživatele, která smí z auth ven. Záměrně BEZ passwordHash — objekt končí v komponentách a tím i v prohlížeči. */
const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  tracksFrom: true,
  periodStartDay: true,
  remindHour: true,
  remindEnabled: true,
  createdAt: true,
} as const

/** V cookie je původní token, v databázi jen jeho sha256. */
export async function createSession(userId: string) {
  const token = randomToken()
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000)
  await prisma.session.create({ data: { id: sha256(token), userId, expiresAt } })
  ;(await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  })
}

export async function destroySession() {
  const jar = await cookies()
  const token = jar.get(COOKIE)?.value
  if (token) await prisma.session.deleteMany({ where: { id: sha256(token) } })
  jar.delete(COOKIE)
}

/** Přihlášený uživatel, nebo null. V rámci jednoho požadavku se dotazuje jen jednou. */
export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(COOKIE)?.value
  if (!token) return null
  const session = await prisma.session.findUnique({ where: { id: sha256(token) }, select: { expiresAt: true, user: { select: USER_SELECT } } })
  if (!session || session.expiresAt < new Date()) return null
  return session.user
})

/** Přihlášený uživatel; jinak přesměruje na přihlášení. */
export async function requireUser(): Promise<NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>> {
  const user = await getCurrentUser()
  if (!user) redirect('/prihlaseni')
  return user
}
