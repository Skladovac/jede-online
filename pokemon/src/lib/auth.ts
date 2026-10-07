import 'server-only'
import { createHash, randomBytes } from 'crypto'
import { cache } from 'react'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

const COOKIE = 'pk_session'
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

/** Přihlášený uživatel, nebo null. V rámci jednoho požadavku se dotazuje jen jednou. */
export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(COOKIE)?.value
  if (!token) return null
  const session = await prisma.session.findUnique({ where: { id: sha256(token) }, include: { user: true } })
  if (!session || session.expiresAt < new Date() || session.user.bannedAt) return null
  return session.user
})

/** Účet nezletilého bez souhlasu rodiče je omezený (skrytý profil, žádné poptávky). */
export const isLimited = (u: { isMinor: boolean; parentConsentAt: Date | null }) => u.isMinor && !u.parentConsentAt

/** Jednorázový token do e-mailu (potvrzení e-mailu, reset hesla). V DB jen hash. */
export async function createEmailToken(userId: string, kind: 'VERIFY' | 'RESET', hours: number) {
  const token = randomToken()
  await prisma.emailToken.create({
    data: { id: sha256(token), userId, kind, expiresAt: new Date(Date.now() + hours * 3_600_000) },
  })
  return token
}

/** Ověří a spotřebuje token. Vrací userId, nebo null. */
export async function consumeEmailToken(token: string, kind: 'VERIFY' | 'RESET') {
  const id = sha256(token)
  const now = new Date()
  // Podmíněný update = token jde použít právě jednou i při dvou souběžných kliknutích.
  const used = await prisma.emailToken.updateMany({ where: { id, kind, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } })
  if (!used.count) return null
  return (await prisma.emailToken.findUnique({ where: { id }, select: { userId: true } }))?.userId ?? null
}
