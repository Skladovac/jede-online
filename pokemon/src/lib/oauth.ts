import 'server-only'
import { createHmac, randomBytes, timingSafeEqual } from 'crypto'
import { APP_URL } from '@/lib/email'

/**
 * Přihlášení přes Google a Facebook (OAuth 2.0 „authorization code“). Vlastní implementace bez knihovny:
 * start → přesměrování k poskytovateli (s náhodným `state` v cookie) → callback → výměna kódu → profil.
 * Klíče: GOOGLE_CLIENT_ID/SECRET, FACEBOOK_APP_ID/SECRET v pokemon.env. Bez klíčů se tlačítka nezobrazí.
 */

export type Provider = 'google' | 'facebook'
export type OAuthProfile = { provider: Provider; providerId: string; email: string | null; emailVerified: boolean; name: string | null }

const cfg = {
  google: () => ({ id: process.env.GOOGLE_CLIENT_ID, secret: process.env.GOOGLE_CLIENT_SECRET }),
  facebook: () => ({ id: process.env.FACEBOOK_APP_ID, secret: process.env.FACEBOOK_APP_SECRET }),
}

export const isProvider = (p: string): p is Provider => p === 'google' || p === 'facebook'
export const providerEnabled = (p: Provider) => !!(cfg[p]().id && cfg[p]().secret)
export const enabledProviders = () => (['google', 'facebook'] as const).filter(providerEnabled)
export const redirectUri = (p: Provider) => `${APP_URL}/api/auth/${p}/callback`

export function authUrl(p: Provider, state: string) {
  const { id } = cfg[p]()
  if (p === 'google') {
    const q = new URLSearchParams({
      client_id: id!,
      redirect_uri: redirectUri(p),
      response_type: 'code',
      scope: 'openid email profile',
      state,
      prompt: 'select_account',
    })
    return `https://accounts.google.com/o/oauth2/v2/auth?${q}`
  }
  const q = new URLSearchParams({ client_id: id!, redirect_uri: redirectUri(p), state, scope: 'email,public_profile', response_type: 'code' })
  return `https://www.facebook.com/v19.0/dialog/oauth?${q}`
}

/** Výměna kódu za token a načtení profilu (id, e-mail, jméno). */
export async function fetchProfile(p: Provider, code: string): Promise<OAuthProfile> {
  const { id, secret } = cfg[p]()
  if (p === 'google') {
    const tok = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: id!, client_secret: secret!, redirect_uri: redirectUri(p), grant_type: 'authorization_code' }),
      signal: AbortSignal.timeout(15_000),
    }).then((r) => r.json() as Promise<{ access_token?: string }>)
    if (!tok.access_token) throw new Error('Google: token nezískán')
    const u = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tok.access_token}` },
      signal: AbortSignal.timeout(15_000),
    }).then((r) => r.json() as Promise<{ sub: string; email?: string; email_verified?: boolean; name?: string }>)
    if (!u.sub) throw new Error('Google: profil nezískán')
    return { provider: p, providerId: u.sub, email: u.email?.toLowerCase() ?? null, emailVerified: !!u.email_verified, name: u.name ?? null }
  }
  const q = new URLSearchParams({ client_id: id!, client_secret: secret!, redirect_uri: redirectUri(p), code })
  const tok = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?${q}`, { signal: AbortSignal.timeout(15_000) }).then(
    (r) => r.json() as Promise<{ access_token?: string }>,
  )
  if (!tok.access_token) throw new Error('Facebook: token nezískán')
  const u = await fetch(`https://graph.facebook.com/me?fields=id,name,email&access_token=${encodeURIComponent(tok.access_token)}`, {
    signal: AbortSignal.timeout(15_000),
  }).then((r) => r.json() as Promise<{ id?: string; email?: string; name?: string }>)
  if (!u.id) throw new Error('Facebook: profil nezískán')
  // Facebook vrací jen potvrzené e-maily.
  return { provider: p, providerId: u.id, email: u.email?.toLowerCase() ?? null, emailVerified: !!u.email, name: u.name ?? null }
}

// ── Podepsaná data v cookie (stav přihlášení, rozpracovaná registrace) ──
const secretKey = () => process.env.AUTH_SECRET || process.env.CRON_SECRET || 'dev-secret'

export function sign(data: object, maxAgeSec: number) {
  const body = Buffer.from(JSON.stringify({ ...data, exp: Date.now() + maxAgeSec * 1000 })).toString('base64url')
  const mac = createHmac('sha256', secretKey()).update(body).digest('base64url')
  return `${body}.${mac}`
}

export function verify<T>(value: string | undefined): T | null {
  if (!value) return null
  const [body, mac] = value.split('.')
  if (!body || !mac) return null
  const expected = createHmac('sha256', secretKey()).update(body).digest('base64url')
  const a = Buffer.from(mac)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString()) as T & { exp: number }
    return data.exp > Date.now() ? data : null
  } catch {
    return null
  }
}

export const newState = () => randomBytes(18).toString('base64url')
export const OAUTH_STATE_COOKIE = 'oauth_state'
export const OAUTH_PENDING_COOKIE = 'oauth_pending'
