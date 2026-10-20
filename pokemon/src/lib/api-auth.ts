import 'server-only'
import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import { sha256 } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'

/**
 * Osobní klíče pro AI asistenty (jen čtení). Klíč „pk_…“ se ukáže jen jednou; v DB je jen otisk sha256.
 * Posílá se buď v hlavičce `Authorization: Bearer pk_…`, nebo (ChatGPT/Claude konektory neumí vlastní hlavičku)
 * v adrese `/mcp/pk_…`. Limit 120 požadavků za minutu na klíč.
 */
export const MAX_TOKENS = 3
export const TOKEN_PREFIX = 'pk_'

export const newToken = () => `${TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`
export const looksLikeToken = (s: string) => /^pk_[A-Za-z0-9_-]{40,50}$/.test(s)

export type ApiUser = { id: string; nickname: string; locale: string; isMinor: boolean; bannedAt: Date | null; tokenId: string }

/** Uživatel podle klíče (null = neplatný / zrušený / zablokovaný / překročený limit). Aktualizuje „naposledy použito“ (max. 1× za minutu). */
export async function userFromToken(raw: string | null | undefined): Promise<ApiUser | { error: string; status: number } | null> {
  if (!raw || !looksLikeToken(raw)) return null
  const hash = sha256(raw)
  if (!rateLimit(`api:${hash.slice(0, 16)}`, 120, 60_000)) return { error: 'Too many requests', status: 429 }
  const tok = await prisma.apiToken.findUnique({
    where: { tokenHash: hash },
    include: { user: { select: { id: true, nickname: true, locale: true, isMinor: true, bannedAt: true } } },
  })
  if (!tok || tok.revokedAt || tok.user.bannedAt) return null
  if (!tok.lastUsedAt || Date.now() - tok.lastUsedAt.getTime() > 60_000)
    prisma.apiToken.update({ where: { id: tok.id }, data: { lastUsedAt: new Date() } }).catch(() => {})
  return { ...tok.user, tokenId: tok.id }
}

/** Klíč z požadavku: hlavička Authorization, nebo segment adresy. */
export function tokenFromRequest(req: Request, pathToken?: string | null) {
  const h = req.headers.get('authorization') ?? ''
  const m = /^Bearer\s+(\S+)$/i.exec(h)
  return m?.[1] ?? pathToken ?? null
}
