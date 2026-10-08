import Link from 'next/link'
import type { Prisma, ProductKind } from '@prisma/client'
import { formatEur, productImage, setLogo } from '@/lib/format'
import { KIND_LABEL } from '@/lib/products'
import { getT } from '@/lib/i18n/server'

export type TileProduct = {
  id: number
  name: string
  kind: ProductKind
  imageUrl: string | null
  priceEur: Prisma.Decimal | null
  set: { logoUrl: string | null } | null
}

/** Dlaždice produktu. Bez obrázku ukáže logo sady a typ produktu. */
export async function ProductTile({ p, extra }: { p: TileProduct; extra?: React.ReactNode }) {
  const t = await getT()
  const img = productImage(p.imageUrl)
  const logo = p.set ? setLogo(p.set.logoUrl) : null
  const price = formatEur(p.priceEur)
  return (
    <Link href={`/produkt/${p.id}`} className="group block">
      <div className="grid aspect-square place-items-center overflow-hidden rounded-xl border border-slate-200 bg-white p-2 transition group-hover:-translate-y-0.5 group-hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt={p.name} loading="lazy" className="max-h-full max-w-full object-contain" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-center">
            {logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="" loading="lazy" className="max-h-12 max-w-[80%] object-contain opacity-70" />
            )}
            <span className="text-xs font-semibold text-slate-400">{t(KIND_LABEL[p.kind])}</span>
          </div>
        )}
      </div>
      <p className="mt-1.5 line-clamp-2 text-xs font-medium">{p.name}</p>
      {price && <p className="text-xs text-slate-500">≈ {price}</p>}
      {extra}
    </Link>
  )
}
