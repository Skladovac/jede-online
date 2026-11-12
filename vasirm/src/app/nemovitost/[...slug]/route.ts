import { prisma } from '@/lib/prisma'
import { SITE_URL } from '@/lib/site'

// Staré adresy z WordPressu (/nemovitost/<slug>/) → nový detail. Trvalé přesměrování, ať Google přenese pozice.
export async function GET(_: Request, { params }: { params: Promise<{ slug: string[] }> }) {
  const raw = (await params).slug[0] ?? ''
  let slug = raw
  try {
    slug = decodeURIComponent(raw)
  } catch {
    // neplatné kódování — necháme jak je
  }
  const listing = await prisma.listing.findFirst({ where: { legacySlug: slug }, select: { slug: true } })
  return Response.redirect(`${SITE_URL}${listing ? `/nabidka/${listing.slug}` : '/nabidka'}`, 301)
}
