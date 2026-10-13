import Link from 'next/link'
import { AlertTriangle, ImageOff, Plus } from 'lucide-react'
import { createListing } from '@/app/actions/admin'
import { listingSrc } from '@/components/Photo'
import { formatArea, formatPrice } from '@/lib/format'
import { STATUS_LABEL, TYPE_LABEL } from '@/lib/labels'
import { prisma } from '@/lib/prisma'

export const metadata = { title: 'Nemovitosti' }

const STATUS_STYLE = {
  DRAFT: 'bg-paper-2 text-stone',
  ACTIVE: 'bg-emerald-100 text-emerald-900',
  RESERVED: 'bg-gold/25 text-ink',
  SOLD: 'bg-ink text-gold-light',
} as const

export default async function ListingsAdmin() {
  const listings = await prisma.listing.findMany({
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    include: {
      images: { orderBy: { sort: 'asc' }, take: 1 },
      agent: { select: { name: true } },
      _count: { select: { images: true, leads: true } },
    },
  })

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="label text-gold-deep">Nemovitosti</p>
          <h1 className="mt-2 font-serif text-4xl">Nabídka</h1>
        </div>
        <form action={createListing}>
          <button type="submit" className="btn-ink">
            <Plus className="h-4 w-4" aria-hidden /> Přidat nemovitost
          </button>
        </form>
      </div>

      <ul className="mt-8 space-y-3">
        {listings.map((l) => {
          const img = l.images[0]
          const warn = l.status !== 'DRAFT' && (!l.energyClass || !l._count.images)
          return (
            <li key={l.id}>
              <Link href={`/admin/nemovitosti/${l.id}`} className="flex gap-4 border border-ink/10 bg-white p-3 transition hover:border-ink/40 sm:gap-5">
                <div className="h-20 w-28 shrink-0 overflow-hidden bg-paper-2 sm:h-24 sm:w-36">
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={listingSrc(l.id, img, 480)} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-stone-light">
                      <ImageOff className="h-6 w-6" aria-hidden />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 py-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[l.status]}`}>{STATUS_LABEL[l.status]}</span>
                    {l.featured && <span className="text-xs font-semibold text-gold-deep">★ Zvýrazněno</span>}
                    {warn && (
                      <span className="flex items-center gap-1 text-xs font-semibold text-amber-700">
                        <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> {!l._count.images ? 'Bez fotek' : 'Chybí PENB'}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 truncate font-semibold">{l.title}</p>
                  <p className="truncate text-sm text-stone">
                    {[l.locality || 'bez lokality', TYPE_LABEL[l.propertyType], l.disposition, formatArea(l.usableArea)].filter(Boolean).join(' · ')}
                  </p>
                  <p className="mt-1 text-sm">
                    <span className="font-semibold tabular-nums">{formatPrice(l.price, l.offerType === 'RENT')}</span>
                    <span className="text-stone">
                      {' '}
                      · {l._count.images} fotek · {l._count.leads} poptávek{l.agent ? ` · ${l.agent.name}` : ''}
                    </span>
                  </p>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
      {!listings.length && <p className="mt-8 border border-dashed border-ink/20 px-5 py-10 text-center text-stone">Zatím tu nic není. Přidejte první nemovitost.</p>}
    </div>
  )
}
