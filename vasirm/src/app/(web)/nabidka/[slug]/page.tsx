import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { EnergyScale } from '@/components/EnergyScale'
import { Gallery } from '@/components/Gallery'
import { JsonLd } from '@/components/JsonLd'
import { ListingCard, StatusBadge } from '@/components/ListingCard'
import { MapEmbed } from '@/components/MapEmbed'
import { MortgageCalc } from '@/components/MortgageCalc'
import { listingSrc } from '@/components/Photo'
import { ViewingForm } from '@/components/ViewingForm'
import { AgentCard, ArrowLink, SectionLabel } from '@/components/ui'
import { formatArea, formatPrice, nbsp, paragraphs } from '@/lib/format'
import { OFFER_LABEL, TYPE_LABEL } from '@/lib/labels'
import { getListingBySlug, getListingCards, readParams } from '@/lib/listings'
import { abs, breadcrumbLd } from '@/lib/seo'
import { SITE, SITE_URL } from '@/lib/site'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const l = await getListingBySlug((await params).slug)
  if (!l) return { title: 'Nemovitost nenalezena' }
  const title = `${l.title}, ${l.locality}`
  const description = `${OFFER_LABEL[l.offerType]} · ${[l.disposition, formatArea(l.usableArea)].filter(Boolean).join(' · ')} · ${formatPrice(l.price)}. ${l.perex}`.slice(0, 300)
  const img = l.images[0]
  return {
    title,
    description,
    alternates: { canonical: `/nabidka/${l.slug}` },
    openGraph: {
      title,
      description,
      url: `/nabidka/${l.slug}`,
      images: img ? [{ url: listingSrc(l.id, img, 1600), width: 1600, height: Math.round((1600 * img.height) / img.width) }] : undefined,
    },
  }
}

export default async function ListingPage({ params }: Props) {
  const l = await getListingBySlug((await params).slug)
  if (!l) notFound()
  const others = await getListingCards({ take: 3, excludeId: l.id })
  const facts = [
    { k: 'Užitná plocha', v: formatArea(l.usableArea) },
    { k: 'Pozemek', v: formatArea(l.landArea) },
    { k: 'Dispozice', v: l.disposition },
    { k: 'Energetická třída', v: l.energyClass ?? '' },
  ].filter((f) => f.v)
  const params2 = readParams(l.params)
  const sold = l.status === 'SOLD'

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: `${l.title}, ${l.locality}`,
    description: l.perex || l.description.slice(0, 300),
    url: `${SITE_URL}/nabidka/${l.slug}`,
    datePosted: l.publishedAt?.toISOString(),
    image: l.images.slice(0, 6).map((img) => abs(listingSrc(l.id, img, 1600))),
    offers: {
      '@type': 'Offer',
      ...(l.price != null && { price: l.price, priceCurrency: 'CZK' }),
      availability: sold ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
      businessFunction: l.offerType === 'RENT' ? 'http://purl.org/goodrelations/v1#LeaseOut' : 'http://purl.org/goodrelations/v1#Sell',
      seller: { '@id': `${SITE_URL}/#vrm` },
    },
    about: {
      '@type': l.propertyType === 'FLAT' ? 'Apartment' : l.propertyType === 'HOUSE' ? 'SingleFamilyResidence' : 'Place',
      address: { '@type': 'PostalAddress', addressLocality: l.locality, addressCountry: 'CZ' },
      ...(l.usableArea && { floorSize: { '@type': 'QuantitativeValue', value: l.usableArea, unitCode: 'MTK' } }),
    },
  }

  return (
    <>
      <JsonLd data={ld} />
      <JsonLd
        data={breadcrumbLd([
          { name: 'Úvod', path: '/' },
          { name: 'Nabídka', path: '/nabidka' },
          { name: l.title, path: `/nabidka/${l.slug}` },
        ])}
      />

      <section className="bg-paper pt-6 md:pt-10">
        <div className="wrap">
          <nav aria-label="Drobečková navigace" className="flex items-center gap-1.5 text-sm text-stone">
            <Link href="/" className="hover:text-ink">
              Úvod
            </Link>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            <Link href="/nabidka" className="hover:text-ink">
              Nabídka
            </Link>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            <span className="truncate text-ink">{l.title}</span>
          </nav>

          <div className="mt-6 flex flex-col justify-between gap-6 pb-8 lg:flex-row lg:items-end">
            <div>
              <p className="label flex flex-wrap items-center gap-3 text-gold-deep">
                {OFFER_LABEL[l.offerType]} · {TYPE_LABEL[l.propertyType]}
                <StatusBadge status={l.status} />
              </p>
              <h1 className="display mt-4 text-[clamp(2.4rem,5.5vw,4.4rem)]">{l.title}</h1>
              <p className="mt-2 text-lg text-stone">{l.locality}</p>
            </div>
            <div className="lg:text-right">
              <p className="label text-stone">{sold ? 'Stav' : l.offerType === 'RENT' ? 'Nájem' : 'Cena'}</p>
              <p className="mt-1 font-serif text-[clamp(2.2rem,4vw,3.2rem)] leading-none tabular-nums">
                {sold ? 'Prodáno' : formatPrice(l.price, l.offerType === 'RENT')}
              </p>
              {l.priceNote && !sold && <p className="mt-2 text-sm text-stone">{l.priceNote}</p>}
            </div>
          </div>

          <Gallery listingId={l.id} images={l.images} title={`${l.title}, ${l.locality}`} />
        </div>
      </section>

      {facts.length > 0 && (
        <section className="bg-paper pt-2">
          <div className="wrap">
            <dl className="grid grid-cols-2 bg-ink text-paper md:grid-cols-4">
              {facts.map((f) => (
                <div key={f.k} className="border-white/10 px-6 py-6 [&:not(:first-child)]:border-l max-md:[&:nth-child(3)]:border-l-0 max-md:[&:nth-child(n+3)]:border-t">
                  <dt className="label text-[0.65rem] text-gold-light">{f.k}</dt>
                  <dd className="mt-2 font-serif text-[1.9rem] leading-none">{f.v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      )}

      <section className="bg-paper py-14 md:py-20">
        <div className="wrap grid gap-14 lg:grid-cols-12">
          <div className="min-w-0 lg:col-span-7 xl:col-span-8">
            {l.perex && <p className="font-serif text-[1.75rem] leading-snug text-ink">{nbsp(l.perex)}</p>}
            <div className="prose-vrm mt-8">
              {paragraphs(l.description).map((p, i) => (
                <p key={i}>{nbsp(p)}</p>
              ))}
            </div>

            {params2.length > 0 && (
              <div className="mt-12">
                <h2 className="label text-gold-deep">Parametry</h2>
                <dl className="mt-4 border-t border-ink/10">
                  {[{ label: 'Typ', value: `${OFFER_LABEL[l.offerType]} · ${TYPE_LABEL[l.propertyType]}` }, ...params2].map((p) => (
                    <div key={p.label} className="grid gap-1 border-b border-ink/10 py-3.5 sm:grid-cols-[13rem_1fr]">
                      <dt className="text-stone">{p.label}</dt>
                      <dd className="font-medium">{p.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {(l.videoPath || l.videoUrl) && (
              <div className="mt-12">
                <h2 className="label text-gold-deep">Videoprohlídka</h2>
                <div className="mt-4 overflow-hidden bg-ink">
                  {l.videoPath ? (
                    <video controls preload="metadata" playsInline className="mx-auto max-h-[80vh] w-full" poster={l.images[0] ? listingSrc(l.id, l.images[0], 1600) : undefined}>
                      <source src={`/media/${l.videoPath}`} type="video/mp4" />
                    </video>
                  ) : (
                    <iframe
                      src={l.videoUrl!}
                      title={`Video: ${l.title}`}
                      className="aspect-video w-full"
                      allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                      loading="lazy"
                    />
                  )}
                </div>
              </div>
            )}

            <div className="mt-12">
              <h2 className="label text-gold-deep">Energetická náročnost</h2>
              <div className="mt-4">
                <EnergyScale value={l.energyClass} />
              </div>
            </div>

            {l.mapQuery && (
              <div className="mt-12">
                <h2 className="label text-gold-deep">Lokalita</h2>
                <div className="mt-4">
                  <MapEmbed query={l.mapQuery} label={l.locality} />
                </div>
              </div>
            )}

            {l.price != null && !sold && l.offerType === 'SALE' && (
              <div className="mt-12">
                <MortgageCalc price={l.price} />
              </div>
            )}
          </div>

          <aside className="lg:col-span-5 xl:col-span-4">
            <div className="sticky top-24 space-y-6">
              <div className="bg-ink p-6 text-paper sm:p-8">
                <p className="label text-gold-light">{sold ? 'Prodáváte podobnou nemovitost?' : 'Domluvte si prohlídku'}</p>
                {l.agent && (
                  <div className="mt-5 border-b border-white/10 pb-6">
                    <AgentCard agent={l.agent} dark />
                  </div>
                )}
                <div className="mt-6 rounded-[2px] bg-paper p-5 text-ink sm:p-6">
                  {sold ? (
                    <div className="space-y-4">
                      <p className="leading-relaxed">Tuto nemovitost jsme už prodali. Rádi vám pomůžeme s prodejem té vaší.</p>
                      <Link href="/odhad-nemovitosti-zdarma" className="btn-gold w-full">
                        Odhad ceny zdarma
                      </Link>
                    </div>
                  ) : (
                    <ViewingForm listingId={l.id} title={`${l.title}, ${l.locality}`} />
                  )}
                </div>
              </div>
              <p className="px-1 text-sm leading-relaxed text-stone">
                Raději telefonicky? Volejte {l.agent?.phone || SITE.phone}.
              </p>
            </div>
          </aside>
        </div>
      </section>

      {others.length > 0 && (
        <section className="border-t border-ink/10 bg-paper-2 py-16 md:py-24">
          <div className="wrap">
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div>
                <SectionLabel>Mohlo by vás zajímat</SectionLabel>
                <h2 data-reveal className="display mt-5 text-[clamp(2.2rem,4vw,3.4rem)]">
                  Další z <em>naší nabídky</em>
                </h2>
              </div>
              <ArrowLink href="/nabidka">Celá nabídka</ArrowLink>
            </div>
            <div className="mt-10 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {others.map((o) => (
                <ListingCard key={o.id} l={o} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  )
}
