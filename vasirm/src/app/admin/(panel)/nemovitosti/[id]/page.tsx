import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { ImageManager } from '@/components/admin/ImageManager'
import { ListingEditor } from '@/components/admin/ListingEditor'
import { VideoManager } from '@/components/admin/VideoManager'
import { readParams } from '@/lib/listings'
import { prisma } from '@/lib/prisma'

export const metadata = { title: 'Úprava nemovitosti' }

export default async function EditListing({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [l, agents] = await Promise.all([
    prisma.listing.findUnique({ where: { id }, include: { images: { orderBy: { sort: 'asc' } } } }),
    prisma.user.findMany({ orderBy: { sort: 'asc' }, select: { id: true, name: true } }),
  ])
  if (!l) notFound()

  return (
    <div>
      <Link href="/admin/nemovitosti" className="inline-flex items-center gap-1.5 text-sm text-stone hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Všechny nemovitosti
      </Link>
      <div className="mt-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <h1 className="font-serif text-4xl">{l.title}</h1>
        {l.status !== 'DRAFT' && (
          <a href={`/nabidka/${l.slug}`} target="_blank" className="inline-flex items-center gap-1.5 text-sm font-semibold hover:text-gold-deep">
            Zobrazit na webu <ExternalLink className="h-4 w-4" aria-hidden />
          </a>
        )}
      </div>

      <section className="mt-8 border border-ink/10 bg-white p-5 sm:p-7">
        <h2 className="font-serif text-2xl">Fotky</h2>
        <p className="mt-1 text-sm text-stone">První fotka je hlavní (na kartě v nabídce). Pořadí změníte přetažením nebo šipkami.</p>
        <ImageManager listingId={l.id} initial={l.images} />
      </section>

      <section className="mt-6 border border-ink/10 bg-white p-5 sm:p-7">
        <h2 className="font-serif text-2xl">Video</h2>
        <VideoManager listingId={l.id} videoPath={l.videoPath} />
      </section>

      <ListingEditor
        listing={{
          id: l.id,
          title: l.title,
          slug: l.slug,
          status: l.status,
          offerType: l.offerType,
          propertyType: l.propertyType,
          locality: l.locality,
          mapQuery: l.mapQuery,
          price: l.price,
          priceNote: l.priceNote,
          usableArea: l.usableArea,
          landArea: l.landArea,
          disposition: l.disposition,
          energyClass: l.energyClass,
          perex: l.perex,
          description: l.description,
          params: readParams(l.params),
          videoUrl: l.videoUrl,
          agentId: l.agentId,
          featured: l.featured,
        }}
        agents={agents}
      />
    </div>
  )
}
