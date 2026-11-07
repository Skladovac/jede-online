import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { TestimonialForm } from '@/components/admin/TeamForms'
import { prisma } from '@/lib/prisma'

export const metadata = { title: 'Reference' }

export default async function EditReference({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [t, agents, listings] = await Promise.all([
    id === 'nova' ? null : prisma.testimonial.findUnique({ where: { id } }),
    prisma.user.findMany({ orderBy: { sort: 'asc' }, select: { id: true, name: true } }),
    prisma.listing.findMany({ where: { status: { not: 'DRAFT' } }, orderBy: { updatedAt: 'desc' }, select: { id: true, title: true, locality: true } }),
  ])
  if (id !== 'nova' && !t) notFound()
  return (
    <div>
      <Link href="/admin/reference" className="inline-flex items-center gap-1.5 text-sm text-stone hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Všechny reference
      </Link>
      <h1 className="mt-3 font-serif text-4xl">{t ? 'Upravit referenci' : 'Nová reference'}</h1>
      <section className="mt-8 max-w-3xl border border-ink/10 bg-white p-5 sm:p-7">
        <TestimonialForm t={t} agents={agents} listings={listings} />
      </section>
    </div>
  )
}
