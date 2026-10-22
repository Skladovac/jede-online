import 'server-only'
import type { ListingStatus, Prisma, PropertyType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { agentSelect } from '@/lib/agents'

export { STATUS_LABEL, TYPE_LABEL, TYPE_PLURAL, TYPE_SLUG, OFFER_LABEL } from '@/lib/labels'

/** Co je vidět na webu (koncepty ne). */
export const PUBLIC_STATUSES: ListingStatus[] = ['ACTIVE', 'RESERVED', 'SOLD']

const card = {
  id: true,
  slug: true,
  title: true,
  status: true,
  offerType: true,
  propertyType: true,
  locality: true,
  price: true,
  usableArea: true,
  landArea: true,
  disposition: true,
  publishedAt: true,
  images: { orderBy: { sort: 'asc' }, take: 1, select: { id: true, width: true, height: true, sizes: true, blur: true, alt: true } },
  _count: { select: { images: true } },
} satisfies Prisma.ListingSelect

export type ListingCard = Prisma.ListingGetPayload<{ select: typeof card }>

/** Pořadí na webu: aktuální nabídka podle data, rezervované za nimi, prodané na konci. */
const STATUS_ORDER: Record<ListingStatus, number> = { ACTIVE: 0, RESERVED: 1, SOLD: 2, DRAFT: 3 }

export async function getListingCards(opts: {
  sold?: boolean
  type?: PropertyType
  sort?: 'new' | 'price-asc' | 'price-desc'
  take?: number
  excludeId?: string
  agentId?: string
}) {
  const where: Prisma.ListingWhereInput = {
    status: opts.sold ? 'SOLD' : { in: ['ACTIVE', 'RESERVED'] },
    ...(opts.type && { propertyType: opts.type }),
    ...(opts.excludeId && { id: { not: opts.excludeId } }),
    ...(opts.agentId && { agentId: opts.agentId }),
  }
  const orderBy: Prisma.ListingOrderByWithRelationInput[] =
    opts.sort === 'price-asc'
      ? [{ price: { sort: 'asc', nulls: 'last' } }]
      : opts.sort === 'price-desc'
        ? [{ price: { sort: 'desc', nulls: 'last' } }]
        : [{ featured: 'desc' }, { publishedAt: 'desc' }]
  const rows = await prisma.listing.findMany({ where, orderBy, take: opts.take, select: card })
  return opts.sort && opts.sort !== 'new' ? rows : rows.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])
}

export function getListingBySlug(slug: string) {
  return prisma.listing.findFirst({
    where: { slug, status: { in: PUBLIC_STATUSES } },
    include: { images: { orderBy: { sort: 'asc' } }, agent: { select: agentSelect } },
  })
}

export type ListingParam = { label: string; value: string }

export function readParams(json: Prisma.JsonValue): ListingParam[] {
  if (!Array.isArray(json)) return []
  return json
    .filter((p): p is { label: string; value: string } => !!p && typeof p === 'object' && 'label' in p && 'value' in p)
    .map((p) => ({ label: String(p.label), value: String(p.value) }))
    .filter((p) => p.label && p.value)
}
