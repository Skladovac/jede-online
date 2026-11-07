import type { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { safeDecode } from '@/lib/validation'
import { getT } from '@/lib/i18n/server'
import { rateLimit } from '@/lib/rate-limit'
import { setShareImage } from '@/lib/og-set'

/**
 * Obrázek ke sdílení ze stránky sady: /api/sdilet/<sada>?typ=postup|chybi
 * Jen pro přihlášeného (kreslí jeho sbírku); stránka ho stáhne a nabídne systémové sdílení nebo uložení.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ set: string }> }) {
  const user = await getCurrentUser()
  if (!user) return new Response('Unauthorized', { status: 401 })
  // Vykreslení je náročné (desítky obrázků karet) — nejvýš 10 za minutu na uživatele.
  if (!rateLimit(`sdilet:${user.id}`, 10, 60_000)) return new Response('Too many requests', { status: 429 })
  const setId = safeDecode((await params).set) ?? ''
  const kind = req.nextUrl.searchParams.get('typ') === 'chybi' ? 'chybi' : 'postup'
  const res = await setShareImage(user, setId, kind, await getT())
  if (!res) return new Response('Not found', { status: 404 })
  res.headers.set('Cache-Control', 'private, no-store')
  res.headers.set('Content-Disposition', `inline; filename="${setId.replace(/[^\w.-]/g, '_')}-${kind}.png"`)
  return res
}
