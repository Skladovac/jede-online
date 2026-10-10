import type { NextRequest } from 'next/server'
import { profileOgImage } from '@/lib/og-profile'

/**
 * Náhledový obrázek profilu: /og/profil?nick=DUKE&ukaz=hledam|nabizim
 * (Mimo /api — to má robots.txt zakázané a Facebook by obrázek nenačetl.)
 */
export async function GET(req: NextRequest) {
  const nick = (req.nextUrl.searchParams.get('nick') ?? '').slice(0, 40)
  const view = req.nextUrl.searchParams.get('ukaz') === 'hledam' ? 'hledam' : 'nabizim'
  const res = await profileOgImage(nick, view)
  res.headers.set('Cache-Control', 'public, max-age=3600, s-maxage=3600')
  return res
}
