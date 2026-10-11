import type { NextRequest } from 'next/server'
import { profileOgImage } from '@/lib/og-profile'
import { clientIp, rateLimit } from '@/lib/rate-limit'

/**
 * Náhledový obrázek profilu: /og/profil?nick=DUKE&ukaz=hledam|nabizim
 * (Mimo /api — to má robots.txt zakázané a Facebook by obrázek nenačetl.)
 */
export async function GET(req: NextRequest) {
  // Vykreslení obrázku je náročné — proti zahlcení max. 30 za minutu z jedné adresy (Facebook si ho stejně kešuje).
  if (!rateLimit(`og:${await clientIp()}`, 30, 60_000)) return new Response('Too many requests', { status: 429 })
  const nick = (req.nextUrl.searchParams.get('nick') ?? '').slice(0, 40)
  const view = req.nextUrl.searchParams.get('ukaz') === 'hledam' ? 'hledam' : 'nabizim'
  const res = await profileOgImage(nick, view)
  res.headers.set('Cache-Control', 'public, max-age=3600, s-maxage=3600')
  return res
}
