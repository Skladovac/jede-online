import { NextResponse, type NextRequest } from 'next/server'
import { OAUTH_STATE_COOKIE, authUrl, isProvider, newState, providerEnabled, sign } from '@/lib/oauth'
import { safeNext } from '@/lib/validation'

export const dynamic = 'force-dynamic'

/** Začátek přihlášení přes Google/Facebook: náhodný `state` do podepsané cookie a přesměrování k poskytovateli. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params
  if (!isProvider(provider) || !providerEnabled(provider)) return NextResponse.redirect(new URL('/prihlaseni', req.url))
  const state = newState()
  const next = safeNext(req.nextUrl.searchParams.get('next'))
  const res = NextResponse.redirect(authUrl(provider, state))
  res.cookies.set(OAUTH_STATE_COOKIE, sign({ state, provider, next }, 600), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  })
  return res
}
