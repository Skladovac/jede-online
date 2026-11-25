import 'server-only'
import { createHash, randomBytes } from 'crypto'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

const COOKIE = 'vrm_session'
const SESSION_DAYS = 30

export const randomToken = () => randomBytes(32).toString('base64url')
export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

export const hashPassword = (pw: string) => bcrypt.hash(pw, 12)
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash)

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

/** Přihlášený makléř, nebo null. V rámci jednoho požadavku se dotazuje jen jednou. */
export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(COOKIE)?.value
  if (!token) return null
  const session = await prisma.session.findUnique({ where: { id: sha256(token) }, include: { user: true } })
  if (!session || session.expiresAt < new Date()) return null
  return session.user
})

/** Pro stránky a akce administrace: bez přihlášení přesměruje na přihlášení. */
export async function requireUser() {
  const user = await getCurrentUser()
  if (!user) redirect('/admin/prihlaseni')
  return user
}
