import type { Metadata } from 'next'
import Link from 'next/link'
import type { PropertyType } from '@prisma/client'
import { ListingCard } from '@/components/ListingCard'
import { PageHero, ValuationCta } from '@/components/ui'
import { TYPE_PLURAL, TYPE_SLUG } from '@/lib/labels'
import { getListingCards } from '@/lib/listings'
import { gridCols } from '@/lib/format'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Nabídka nemovitostí — Zlín a okolí',
  description: 'Aktuální nabídka rodinných domů, bytů a pozemků ve Zlíně a okolí. Profesionální fotografie, videoprohlídky a osobní přístup makléřů VRM.',
  alternates: { canonical: '/nabidka' },
}

const SORTS = { new: 'Nejnovější', 'price-asc': 'Od nejlevnějších', 'price-desc': 'Od nejdražších' } as const
type Sort = keyof typeof SORTS

type Search = { typ?: string; stav?: string; razeni?: string }

function href(base: Search, change: Search) {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries({ ...base, ...change })) if (v) q.set(k, v)
  const s = q.toString()
  return s ? `/nabidka?${s}` : '/nabidka'
}

export default async function OffersPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams
  const type = (Object.keys(TYPE_SLUG) as PropertyType[]).find((t) => TYPE_SLUG[t] === sp.typ)
  const sold = sp.stav === 'prodano'
  const sort: Sort = sp.razeni && sp.razeni in SORTS ? (sp.razeni as Sort) : 'new'

  const [listings, typeCounts, soldCount] = await Promise.all([
    getListingCards({ sold, type, sort }),
    prisma.listing.groupBy({
      by: ['propertyType'],
      where: { status: sold ? 'SOLD' : { in: ['ACTIVE', 'RESERVED'] } },
      _count: true,
    }),
    prisma.listing.count({ where: { status: 'SOLD' } }),
  ])
  const types = typeCounts.filter((t) => t._count > 0)
  const base: Search = { typ: sp.typ, stav: sp.stav, razeni: sp.razeni }

  const chip = (active: boolean) =>
    `inline-flex min-h-[2.5rem] items-center rounded-full border px-4 text-sm transition ${
      active ? 'border-gold bg-gold text-ink' : 'border-white/20 text-paper/80 hover:border-gold hover:text-gold-light'
    }`

  return (
    <>
      <PageHero
        label={sold ? 'Reference' : 'Nabídka'}
        title={
          sold ? (
            <>
              Co jsme <em className="text-gold-light">už prodali</em>
            </>
          ) : (
            <>
              Domovy, které <em className="text-gold-light">čekají na vás</em>
            </>
          )
        }
        lead={
          sold
            ? 'Nemovitosti, kterým jsme pomohli k novým majitelům.'
            : 'Každou nemovitost u nás osobně známe. Na prohlídku vás provedeme sami a odpovíme na cokoliv, co vás zajímá.'
        }
      >
        <div data-reveal className="mt-10 flex flex-wrap items-center gap-2">
          <Link href={href(base, { stav: '', typ: '' })} className={chip(!sold && !type)}>
            Vše v nabídce
          </Link>
          {!sold &&
            types.map((t) => (
              <Link key={t.propertyType} href={href(base, { typ: TYPE_SLUG[t.propertyType] })} className={chip(type === t.propertyType)}>
                {TYPE_PLURAL[t.propertyType]} <span className="ml-1.5 opacity-60">{t._count}</span>
              </Link>
            ))}
          {soldCount > 0 && (
            <Link href={href(base, { stav: 'prodano', typ: '' })} className={chip(sold)}>
              Prodáno <span className="ml-1.5 opacity-60">{soldCount}</span>
            </Link>
          )}
        </div>
      </PageHero>

      <section className="bg-paper py-14 md:py-20">
        <div className="wrap">
          <div className="flex flex-col justify-between gap-4 border-b border-ink/10 pb-5 sm:flex-row sm:items-center">
            <p className="text-stone">
              {listings.length === 1 ? '1 nemovitost' : listings.length >= 2 && listings.length <= 4 ? `${listings.length} nemovitosti` : `${listings.length} nemovitostí`}
            </p>
            {!sold && listings.length > 1 && (
              <nav aria-label="Řazení" className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                {(Object.keys(SORTS) as Sort[]).map((s) => (
                  <Link
                    key={s}
                    href={href(base, { razeni: s === 'new' ? '' : s })}
                    className={sort === s ? 'font-semibold text-ink underline decoration-gold decoration-2 underline-offset-[6px]' : 'text-stone hover:text-ink'}
                    aria-current={sort === s ? 'true' : undefined}
                  >
                    {SORTS[s]}
                  </Link>
                ))}
              </nav>
            )}
          </div>

          {listings.length ? (
            <div className={`mt-10 grid gap-x-8 gap-y-12 sm:grid-cols-2 ${gridCols(listings.length)}`}>
              {listings.map((l, i) => (
                <ListingCard key={l.id} l={l} priority={i < 3} />
              ))}
            </div>
          ) : (
            <div className="py-20 text-center">
              <p className="font-serif text-3xl">Momentálně tu nic není</p>
              <p className="mx-auto mt-3 max-w-md text-stone">
                Nové nemovitosti přibývají průběžně. Napište nám, co hledáte, a ozveme se, jakmile budeme mít něco pro vás.
              </p>
              <Link href="/kontakt" className="btn-ink mt-6">
                Napsat, co hledám
              </Link>
            </div>
          )}
        </div>
      </section>

      <ValuationCta />
    </>
  )
}
