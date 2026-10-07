import { NextResponse, type NextRequest } from 'next/server'
import { searchCards } from '@/lib/search'
import { cardImage, formatEur } from '@/lib/format'

export const dynamic = 'force-dynamic'

// Našeptávač ve vyhledávacím poli.
export async function GET(req: NextRequest) {
  const hits = await searchCards(req.nextUrl.searchParams.get('q') ?? '', 8)
  return NextResponse.json(
    hits.map((c) => ({
      id: c.id,
      name: c.name,
      number: `${c.set.code ? c.set.code + ' ' : ''}${c.localId}/${c.set.officialCount}`,
      set: c.set.name,
      image: cardImage(c.imageUrl),
      price: formatEur(c.priceEur),
    })),
    { headers: { 'Cache-Control': 'public, max-age=300' } },
  )
}
