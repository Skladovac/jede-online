import { NextResponse, type NextRequest } from 'next/server'
import { searchCards, searchProducts } from '@/lib/search'
import { cardImage, formatEur, productImage } from '@/lib/format'
import { KIND_LABEL } from '@/lib/products'
import { ensureEurCzk } from '@/lib/fx'

export const dynamic = 'force-dynamic'

// Našeptávač ve vyhledávacím poli.
export async function GET(req: NextRequest) {
  await ensureEurCzk() // kurz ČNB pro korunové částky u cen
  const q = req.nextUrl.searchParams.get('q') ?? ''
  const [hits, products] = await Promise.all([searchCards(q, 6), searchProducts(q, 3)])
  return NextResponse.json(
    [
      ...hits.map((c) => ({
      href: `/karta/${encodeURIComponent(c.id)}`,
      id: c.id,
      name: c.name,
      number: `${c.set.code ? c.set.code + ' ' : ''}${c.localId}/${c.set.officialCount}`,
      set: c.set.name,
      image: cardImage(c.imageUrl),
      price: formatEur(c.priceEur),
      })),
      ...products.map((p) => ({
        id: `p${p.id}`,
        href: `/produkt/${p.id}`,
        name: p.name,
        number: KIND_LABEL[p.kind],
        set: 'Produkt',
        image: productImage(p.imageUrl),
        price: formatEur(p.priceEur),
      })),
    ],
    { headers: { 'Cache-Control': 'public, max-age=300' } },
  )
}
