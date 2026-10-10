import type { Metadata } from 'next'
import Link from 'next/link'
import type { Prisma, ProductKind } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ensureEurCzk } from '@/lib/fx'
import { KIND_LABEL } from '@/lib/products'
import { ProductTile } from '@/components/ProductTile'
import { PriceNote } from '@/components/PriceNote'
import { getT } from '@/lib/i18n/server'

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
    `rounded-full px-3 py-1 text-sm ${active ? 'bg-accent-strong text-on-accent' : 'border border-line-strong'}`

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-black tracking-tight">{t('Zapečetěné produkty')}</h1>
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
          className="w-full max-w-md rounded-full border border-line-strong bg-card px-4 py-2 text-sm"
        />
        <button className="rounded-full bg-accent-strong px-4 py-2 text-sm font-semibold text-on-accent">
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
        <p className="mt-8 text-subtle">{t('Nic jsme nenašli.')}</p>
      )}

      {total > PAGE && (
        <div className="mt-8 flex items-center justify-center gap-4 text-sm">
          {page > 1 && <Link href={href({ strana: String(page - 1) })}>← {t('Předchozí')}</Link>}
          <span className="text-subtle">
            {page} / {Math.ceil(total / PAGE)}
          </span>
          {page * PAGE < total && <Link href={href({ strana: String(page + 1) })}>{t('Další')} →</Link>}
        </div>
      )}
      <PriceNote className="mt-8" />
    </main>
  )
}
