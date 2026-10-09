import { NextResponse, type NextRequest } from 'next/server'
import { searchCards, searchProducts } from '@/lib/search'
import { cardImage, formatEur, productImage } from '@/lib/format'
import { KIND_LABEL } from '@/lib/products'
import { ensureEurCzk } from '@/lib/fx'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { getT } from '@/lib/i18n/server'

export const dynamic = 'force-dynamic'

// Našeptávač ve vyhledávacím poli.
export async function GET(req: NextRequest) {
  // Našeptávač volá při psaní — 120 dotazů za minutu z jedné adresy bohatě stačí.
  if (!rateLimit(`search:${await clientIp()}`, 120, 60_000)) return NextResponse.json([], { status: 429 })
  await ensureEurCzk() // kurz ČNB pro korunové částky u cen
  const t = await getT()
  const q = (req.nextUrl.searchParams.get('q') ?? '').slice(0, 100)
  const [hits, products] = await Promise.all([searchCards(q, 6), searchProducts(q, 3)])
  return NextResponse.json(
    [
      ...hits.map((c) => ({
      href: `/karta/${encodeURIComponent(c.id)}`,
      id: c.id,
      name: c.name,
      number: `${c.set.code ? c.set.code + ' ' : ''}${c.localId}${c.set.officialCount ? `/${c.set.officialCount}` : ''}`,
      set: c.set.name,
      image: cardImage(c.imageUrl),
      price: formatEur(c.priceEur),
      })),
      ...products.map((p) => ({
        id: `p${p.id}`,
        href: `/produkt/${p.id}`,
        name: p.name,
        number: t(KIND_LABEL[p.kind]),
        set: t('Produkt'),
        image: productImage(p.imageUrl),
        price: formatEur(p.priceEur),
      })),
    ],
    { headers: { 'Cache-Control': 'private, max-age=300', Vary: 'Cookie, Accept-Language' } },
  )
}
