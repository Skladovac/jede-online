import type { Metadata } from 'next'
import Link from 'next/link'
import { TestimonialCard } from '@/components/agents'
import { PageHero, ValuationCta } from '@/components/ui'
import { SHOW_LISTINGS } from '@/lib/site'
import { getTestimonials } from '@/lib/testimonials'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Reference klientů',
  description: 'Co o spolupráci s makléři VRM říkají klienti, kterým jsme pomohli prodat nebo koupit nemovitost ve Zlíně a okolí.',
  alternates: { canonical: '/reference' },
}

export default async function ReferencesPage() {
  const items = await getTestimonials()
  return (
    <>
      <PageHero
        label="Reference"
        title={
          <>
            Co o nás říkají <em className="text-gold-light">klienti.</em>
          </>
        }
        lead="Každá věta tady je od skutečného klienta, který s námi prodával nebo kupoval. Zveřejňujeme je jen s jeho souhlasem."
      />
      <section className="bg-paper-2 py-16 md:py-24">
        <div className="wrap">
          {items.length ? (
            <div className="columns-1 gap-6 md:columns-2 lg:columns-3 [&>*]:mb-6 [&>*]:break-inside-avoid">
              {items.map((t) => (
                <TestimonialCard key={t.id} t={t} />
              ))}
            </div>
          ) : (
            <div className="py-12 text-center">
              <p className="font-serif text-3xl">Reference právě sbíráme</p>
              <p className="mx-auto mt-3 max-w-md text-stone">
                {SHOW_LISTINGS ? 'Mezitím se podívejte, co jsme už prodali, nebo nám rovnou zavolejte.' : 'Mezitím nám klidně rovnou zavolejte nebo napište.'}
              </p>
              <Link href={SHOW_LISTINGS ? '/nabidka?stav=prodano' : '/kontakt'} className="btn-ink mt-6">
                {SHOW_LISTINGS ? 'Prodané nemovitosti' : 'Kontakt'}
              </Link>
            </div>
          )}
        </div>
      </section>
      <ValuationCta />
    </>
  )
}
