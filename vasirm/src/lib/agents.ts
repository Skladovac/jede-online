import 'server-only'
import { cache } from 'react'
import { prisma } from '@/lib/prisma'

/** Makléři pro web (patička, O nás, kontakty). Bez hesel a přihlašovacích údajů. */
export const getAgents = cache(() =>
  prisma.user.findMany({
    orderBy: [{ sort: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, slug: true, role: true, phone: true, publicEmail: true, bio: true, photo: true },
  }),
)

export type Agent = Awaited<ReturnType<typeof getAgents>>[number]
