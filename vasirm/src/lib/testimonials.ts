import 'server-only'
import { cache } from 'react'
import { prisma } from '@/lib/prisma'

/** Zveřejněné reference — jen se souhlasem klienta. */
export const getTestimonials = cache((agentId?: string, take?: number) =>
  prisma.testimonial.findMany({
    where: { published: true, consent: true, ...(agentId && { agentId }) },
    orderBy: [{ sort: 'asc' }, { createdAt: 'desc' }],
    take,
    include: {
      agent: { select: { name: true, slug: true } },
      listing: {
        select: {
          id: true,
          slug: true,
          status: true,
          images: { orderBy: { sort: 'asc' }, take: 1, select: { id: true, width: true, height: true, sizes: true, blur: true, alt: true } },
        },
      },
    },
  }),
)

export type TestimonialItem = Awaited<ReturnType<typeof getTestimonials>>[number]

export const countTestimonials = cache(() => prisma.testimonial.count({ where: { published: true, consent: true } }))
