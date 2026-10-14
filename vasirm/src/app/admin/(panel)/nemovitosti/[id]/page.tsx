import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { ImageManager } from '@/components/admin/ImageManager'
import { ListingEditor } from '@/components/admin/ListingEditor'
import { RealmanPanel } from '@/components/admin/RealmanPanel'
import { VideoManager } from '@/components/admin/VideoManager'
import { listingSrc } from '@/components/Photo'
import { formatArea, formatPrice } from '@/lib/format'
import { OFFER_LABEL, STATUS_LABEL, TYPE_LABEL } from '@/lib/labels'
import { readParams } from '@/lib/listings'
import { prisma } from '@/lib/prisma'

export const metadata = { title: 'Úprava nemovitosti' }

export default async function EditListing({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [l, agents] = await Promise.all([
    prisma.listing.findUnique({ where: { id }, include: { images: { orderBy: { sort: 'asc' } }, agent: { select: { name: true } } } }),
    prisma.user.findMany({ orderBy: { sort: 'asc' }, select: { id: true, name: true } }),
  ])
  if (!l) notFound()
  const realman = l.source === 'REALMAN'

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

      {realman ? (
        <>
          <RealmanPanel
            id={l.id}
            externalId={l.externalId ?? ''}
            featured={l.featured}
            syncState={l.syncState}
            syncError={l.syncError}
            canRetry={!!l.syncPayload}
          />
          <section className="mt-6 border border-ink/10 bg-white p-5 sm:p-7">
            <h2 className="font-serif text-2xl">Údaje z Realmanu</h2>
            <dl className="mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              {[
                ['Stav na webu', STATUS_LABEL[l.status]],
                ['Nabídka', `${OFFER_LABEL[l.offerType]} · ${TYPE_LABEL[l.propertyType]}`],
                ['Lokalita', l.locality],
                ['Cena', `${formatPrice(l.price, l.offerType === 'RENT')}${l.priceNote ? ` (${l.priceNote})` : ''}`],
                ['Plocha / pozemek', [formatArea(l.usableArea), formatArea(l.landArea)].filter(Boolean).join(' / ') || '—'],
                ['Dispozice', l.disposition || '—'],
                ['PENB', l.energyClass ?? 'neuvedeno'],
                ['Makléř', l.agent?.name ?? 'nespárován (e-mail makléře v Realmanu nesedí s žádným účtem)'],
                ['Poslední export', l.externalUpdated ?? '—'],
              ].map(([k, v]) => (
                <div key={k} className="grid grid-cols-[9rem_1fr] gap-2 border-b border-ink/10 py-1.5">
                  <dt className="text-stone">{k}</dt>
                  <dd className="font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            {l.images.length > 0 && (
              <ul className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
                {l.images.map((img) => (
                  <li key={img.id} className="aspect-[4/3] overflow-hidden bg-paper-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {img.sizes.length > 0 && <img src={listingSrc(l.id, img, 480)} alt="" className="h-full w-full object-cover" />}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : (
        <>
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
        </>
      )}
    </div>
  )
}
