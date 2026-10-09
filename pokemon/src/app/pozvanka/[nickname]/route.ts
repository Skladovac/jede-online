import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { APP_URL } from '@/lib/email'
import { INVITE_COOKIE } from '@/lib/social'
import { safeDecode } from '@/lib/validation'

/** Pozvánkový odkaz /pozvanka/PŘEZDÍVKA: zapamatuje si zvoucího (30 dní) a pošle na registraci. */
export async function GET(_: NextRequest, { params }: { params: Promise<{ nickname: string }> }) {
  const nick = safeDecode((await params).nickname) ?? ''
  const inviter = await prisma.user.findFirst({
    where: { nickname: { equals: nick, mode: 'insensitive' }, bannedAt: null },
    select: { nickname: true },
  })
  if (!inviter) return NextResponse.redirect(`${APP_URL}/registrace`)
  const res = NextResponse.redirect(`${APP_URL}/registrace?pozval=${encodeURIComponent(inviter.nickname)}`)
  res.cookies.set(INVITE_COOKIE, inviter.nickname, { maxAge: 30 * 24 * 3600, httpOnly: true, sameSite: 'lax', secure: true, path: '/' })
  return res
}
