import Link from 'next/link'
import { Camera } from 'lucide-react'
import { ListingPhoto } from '@/components/Photo'
import { formatArea, formatPrice } from '@/lib/format'
import { OFFER_LABEL, STATUS_LABEL } from '@/lib/labels'
import type { ListingCard as Card } from '@/lib/listings'

export function StatusBadge({ status, className = '' }: { status: Card['status']; className?: string }) {
  if (status === 'ACTIVE' || status === 'DRAFT') return null
  return (
    <span
      className={`label inline-block px-3 py-1.5 text-[0.65rem] ${status === 'SOLD' ? 'bg-ink text-gold-light' : 'bg-gold text-ink'} ${className}`}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}

export function ListingCard({ l, priority = false, index }: { l: Card; priority?: boolean; index?: number }) {
  const img = l.images[0]
  const facts = [l.disposition, formatArea(l.usableArea), l.landArea ? `pozemek ${formatArea(l.landArea)}` : ''].filter(Boolean)
  return (
    <article data-reveal className="group relative">
      <Link href={`/nabidka/${l.slug}`} className="block">
        <div className="relative aspect-[4/3] overflow-hidden bg-paper-3">
          {img ? (
            <ListingPhoto
              listingId={l.id}
              img={img}
              alt={l.title}
              sizes="(min-width: 1024px) 30vw, (min-width: 640px) 50vw, 100vw"
              priority={priority}
              className={`h-full w-full object-cover transition duration-[1.2s] ease-out group-hover:scale-[1.04] ${l.status === 'SOLD' ? 'grayscale-[0.6]' : ''}`}
            />
          ) : (
            <div className="module-grid h-full w-full bg-ink-2" />
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-ink/60 to-transparent" />
          <div className="absolute left-4 top-4 flex gap-2">
            <StatusBadge status={l.status} />
          </div>
          {l._count.images > 1 && (
            <span className="absolute bottom-3 right-4 flex items-center gap-1.5 text-xs font-medium text-white/90">
              <Camera className="h-3.5 w-3.5" aria-hidden />
              {l._count.images}
            </span>
          )}
          {index != null && (
            <span className="absolute bottom-3 left-4 font-serif text-lg leading-none text-white/85">{String(index + 1).padStart(2, '0')}</span>
          )}
        </div>
        <div className="border-b border-ink/10 pb-5 pt-5 transition-colors group-hover:border-gold">
          <p className="label text-gold-deep">
            {OFFER_LABEL[l.offerType]} · {l.locality}
          </p>
          <h3 className="mt-2 font-serif text-[1.6rem] leading-[1.1] text-ink">{l.title}</h3>
          <p className="mt-2 text-[0.95rem] text-stone">{facts.join(' · ')}</p>
          <p className="mt-4 text-lg font-semibold tabular-nums text-ink">
            {l.status === 'SOLD' ? 'Prodáno' : formatPrice(l.price, l.offerType === 'RENT')}
          </p>
        </div>
      </Link>
    </article>
  )
}
