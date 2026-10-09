import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createSession } from '@/lib/auth'
import { OAUTH_PENDING_COOKIE, OAUTH_STATE_COOKIE, fetchProfile, isProvider, sign, verify } from '@/lib/oauth'

export const dynamic = 'force-dynamic'

const BASE = process.env.APP_URL ?? 'https://pokemon.jede.online'

/**
 * Návrat od Google/Facebooku. Tři možnosti:
 * 1) účet je už propojený → přihlásit; 2) stejný (potvrzený) e-mail už u nás je → propojit a přihlásit;
 * 3) nový uživatel → podepsaná rozpracovaná registrace v cookie a dokončení na /registrace/dokonceni
 *    (přezdívka, datum narození, kraj, u dětí souhlas rodiče — stejná pravidla jako u běžné registrace).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params
  const fail = (code: string) => NextResponse.redirect(`${BASE}/prihlaseni?chyba=${code}`)
  if (!isProvider(provider)) return fail('oauth')
  const saved = verify<{ state: string; provider: string; next: string | null }>(req.cookies.get(OAUTH_STATE_COOKIE)?.value)
  const code = req.nextUrl.searchParams.get('code')
  if (!saved || saved.provider !== provider || saved.state !== req.nextUrl.searchParams.get('state') || !code) return fail('oauth')

  let profile
  try {
    profile = await fetchProfile(provider, code)
  } catch (err) {
    console.error('[oauth]', err)
    return fail('oauth')
  }
  const next = saved.next ?? '/'

  const linked = await prisma.oAuthAccount.findUnique({
    where: { provider_providerId: { provider, providerId: profile.providerId } },
    include: { user: true },
  })
  let user = linked?.user ?? null
  if (!user && profile.email && profile.emailVerified) {
    user = await prisma.user.findUnique({ where: { email: profile.email } })
    if (user) {
      await prisma.oAuthAccount.create({ data: { userId: user.id, provider, providerId: profile.providerId } })
      // Poskytovatel e-mail ověřil — u nás ho tedy můžeme brát jako potvrzený.
      if (!user.emailVerifiedAt) await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } })
    }
  }

  if (user) {
    if (user.bannedAt) return fail('blokovan')
    await createSession(user.id)
    const res = NextResponse.redirect(`${BASE}${next}`)
    res.cookies.delete(OAUTH_STATE_COOKIE)
    if (!req.cookies.get('lang')) res.cookies.set('lang', user.locale, { path: '/', maxAge: 365 * 86_400, sameSite: 'lax' })
    return res
  }

  const res = NextResponse.redirect(`${BASE}/registrace/dokonceni`)
  res.cookies.delete(OAUTH_STATE_COOKIE)
  res.cookies.set(OAUTH_PENDING_COOKIE, sign({ ...profile, next }, 1800), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 1800,
  })
  return res
}
