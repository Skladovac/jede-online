import type { Metadata } from 'next'
import Link from 'next/link'
import type { Prisma, ProductKind } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ensureEurCzk } from '@/lib/fx'
import { KIND_LABEL } from '@/lib/products'
import { ProductTile } from '@/components/ProductTile'
import { PriceNote } from '@/components/PriceNote'
import { getT } from '@/lib/i18n/server'
import { EmptyState, btnPrimary } from '@/components/design'
import { ArrowLeft, ArrowRight, Search } from 'lucide-react'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t('Produkty') }
}
export const dynamic = 'force-dynamic'

const PAGE = 60

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ typ?: string; q?: string; nabidky?: string; strana?: string }>
}) {
  await ensureEurCzk() // kurz ČNB pro korunové částky u cen
  const t = await getT()
  const sp = await searchParams
  const kind = sp.typ && sp.typ in KIND_LABEL ? (sp.typ as ProductKind) : undefined
  const q = (sp.q ?? '').trim().slice(0, 60)
  const onlyOffers = sp.nabidky === '1'
  const page = Math.max(1, Number(sp.strana) || 1)

  const where: Prisma.ProductWhereInput = {
    game: 'pokemon',
    ...(kind && { kind }),
    ...(q && { name: { contains: q, mode: 'insensitive' } }),
    ...(onlyOffers && {
      items: {
        some: {
          spareQty: { gt: 0 },
          offerType: { not: null },
          hiddenAt: null,
          user: { bannedAt: null, OR: [{ isMinor: false }, { parentConsentAt: { not: null } }] },
        },
      },
    }),
  }
  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      include: { set: { select: { logoUrl: true } } },
      // Produkty s obrázkem a novější napřed.
      orderBy: [{ imageUrl: { sort: 'asc', nulls: 'last' } }, { addedAt: { sort: 'desc', nulls: 'last' } }],
      skip: (page - 1) * PAGE,
      take: PAGE,
    }),
  ])

  const href = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams()
    const merged = { typ: kind, q: q || undefined, nabidky: onlyOffers ? '1' : undefined, ...patch }
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v)
    return `/produkty${p.size ? `?${p}` : ''}`
  }
  const chip = (active: boolean) =>
    `inline-flex min-h-9 items-center rounded-full px-3.5 py-1 text-sm font-semibold transition ${active ? 'bg-[var(--ink)] text-white dark:bg-white dark:text-[var(--ink)]' : 'text-muted shadow-[inset_0_0_0_1px_var(--border-strong)] hover:text-fg'}`

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-4xl font-extrabold text-fg sm:text-[44px]">{t('Zapečetěné produkty')}</h1>
      <p className="mt-2 text-muted">
        {t('Boostery, Elite Trainer Boxy, tins, kolekce a mince.')} {t('{n} produktů.', { n: total.toLocaleString('cs-CZ') })}
      </p>

      <form action="/produkty" className="mt-6 flex gap-2">
        {kind && <input type="hidden" name="typ" value={kind} />}
        {onlyOffers && <input type="hidden" name="nabidky" value="1" />}
        <input
          name="q"
          defaultValue={q}
          placeholder={t('Hledat produkt: Prismatic Evolutions ETB…')}
          className="min-h-11 w-full max-w-md rounded-xl border border-line-strong bg-card px-4 py-2 text-base text-fg outline-none placeholder:text-subtle focus:border-brand-blue focus:ring-4 focus:ring-[rgba(42,117,187,0.15)]"
        />
        <button className={btnPrimary}>
          <Search strokeWidth={1.75} aria-hidden />
          {t('Hledat')}
        </button>
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={href({ typ: undefined, strana: undefined })} className={chip(!kind)}>
          {t('Vše')}
        </Link>
        {(Object.keys(KIND_LABEL) as ProductKind[]).map((k) => (
          <Link key={k} href={href({ typ: k, strana: undefined })} className={chip(kind === k)}>
            {t(KIND_LABEL[k])}
          </Link>
        ))}
        <Link href={href({ nabidky: onlyOffers ? undefined : '1', strana: undefined })} className={chip(onlyOffers)}>
          {t('Jen co někdo nabízí')}
        </Link>
      </div>

      {products.length ? (
        <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {products.map((p) => (
            <li key={p.id}>
              <ProductTile p={p} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState className="mt-8">{t('Nic jsme nenašli.')}</EmptyState>
      )}

      {total > PAGE && (
        <div className="mt-8 flex items-center justify-center gap-4 text-sm">
          {page > 1 && (
            <Link href={href({ strana: String(page - 1) })} className="inline-flex min-h-11 items-center gap-1 font-semibold text-accent">
              <ArrowLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              {t('Předchozí')}
            </Link>
          )}
          <span className="font-mono tabular-nums text-subtle">
            {page} / {Math.ceil(total / PAGE)}
          </span>
          {page * PAGE < total && (
            <Link href={href({ strana: String(page + 1) })} className="inline-flex min-h-11 items-center gap-1 font-semibold text-accent">
              {t('Další')}
              <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            </Link>
          )}
        </div>
      )}
      <PriceNote className="mt-8" />
    </main>
  )
}
