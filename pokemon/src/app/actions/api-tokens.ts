'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, sha256 } from '@/lib/auth'
import { MAX_TOKENS, newToken } from '@/lib/api-auth'
import { rateLimit } from '@/lib/rate-limit'
import { str } from '@/lib/validation'
import { getT } from '@/lib/i18n/server'

export type TokenState = { token?: string; error?: string }

/** Vytvoří osobní klíč pro AI; vrátí ho jen jednou (ukládáme jen otisk). */
export async function createApiToken(_: TokenState, fd: FormData): Promise<TokenState> {
  const t = await getT()
  const user = await getCurrentUser()
  if (!user) return { error: t('Přihlas se.') }
  if (!user.emailVerifiedAt) return { error: t('Klíč pro AI vytvoříš po potvrzení e-mailu.') }
  if (!rateLimit(`token:${user.id}`, 10, 3_600_000)) return { error: t('Zkus to zase za chvíli.') }
  const name = str(fd, 'name').replace(/\s+/g, ' ').slice(0, 40) || 'AI'
  const active = await prisma.apiToken.count({ where: { userId: user.id, revokedAt: null } })
  if (active >= MAX_TOKENS) return { error: t('Můžeš mít nejvýš {n} aktivní klíče. Nějaký nejdřív zruš.', { n: MAX_TOKENS }) }
  const token = newToken()
  await prisma.apiToken.create({ data: { userId: user.id, name, tokenHash: sha256(token), last4: token.slice(-4) } })
  revalidatePath('/ucet')
  return { token }
}

export async function revokeApiToken(fd: FormData) {
  const user = await getCurrentUser()
  if (!user) return
  await prisma.apiToken.updateMany({ where: { id: str(fd, 'id'), userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } })
  revalidatePath('/ucet')
}
