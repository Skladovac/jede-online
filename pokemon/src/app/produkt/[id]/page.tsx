import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { formatEur, productImage, setLogo } from '@/lib/format'
import { KIND_LABEL } from '@/lib/products'
import { toggleProductWant } from '@/app/actions/products'
import { ProductBuyForm } from '@/components/BuyForm'
import { ProductBuyers } from '@/components/Buyers'
import { PriceNote } from '@/components/PriceNote'
import { PriceStatsTable } from '@/components/PriceStatsTable'
import { eurCzkDate } from '@/lib/fx'
import type { PriceStats } from '@/lib/price-stats'
import { ActionForm } from '@/components/ActionForm'
import { Submit } from '@/components/ui'
import { ProductItemForm } from '@/components/ProductItemForm'
import { AddToCart } from '@/components/AddToCart'
import { ensureEurCzk } from '@/lib/fx'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

async function getProduct(id: string) {
  const n = Number(id)
  return Number.isInteger(n) ? prisma.product.findUnique({ where: { id: n }, include: { set: true } }) : null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getProduct((await params).id)
  return { title: p ? p.name : 'Produkt nenalezen' }
}

const OFFER_ORDER = { GIFT: 0, SELL: 1, TRADE: 2 } as const

export default async function ProductPage({ params }: Props) {
  await ensureEurCzk() // kurz ČNB pro korunové částky u cen
  const p = await getProduct((await params).id)
  if (!p) notFound()
  const viewer = await getCurrentUser()

  const [offers, mine, want, wantCount] = await Promise.all([
    prisma.productItem.findMany({
      where: {
        productId: p.id,
        spareQty: { gt: 0 },
        offerType: { not: null },
        hiddenAt: null,
        user: { bannedAt: null, OR: [{ isMinor: false }, { parentConsentAt: { not: null } }] },
      },
      include: { user: { select: { nickname: true, city: true, region: true } } },
      take: 100,
    }),
    viewer ? prisma.productItem.findMany({ where: { userId: viewer.id, productId: p.id }, orderBy: { createdAt: 'asc' } }) : [],
    viewer ? prisma.productWant.findFirst({ where: { userId: viewer.id, productId: p.id } }) : null,
    prisma.productWant.count({ where: { productId: p.id } }),
  ])
  offers.sort(
    (a, b) => OFFER_ORDER[a.offerType!] - OFFER_ORDER[b.offerType!] || (a.priceCzk ?? Infinity) - (b.priceCzk ?? Infinity),
  )
  const img = productImage(p.imageUrl, 'high')
  const logo = p.set ? setLogo(p.set.logoUrl) : null
  const price = formatEur(p.priceEur)

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Link href={p.set ? `/sady/${encodeURIComponent(p.set.id)}?tab=produkty` : '/produkty'} className="text-sm text-slate-500 hover:underline">
        ← {p.set ? p.set.name : 'Produkty'}
      </Link>
      <div className="mt-6 grid gap-8 md:grid-cols-[minmax(0,360px)_1fr]">
        <div className="mx-auto grid aspect-square w-full max-w-[360px] place-items-center overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt={p.name} className="max-h-full max-w-full object-contain" />
          ) : (
            <div className="flex flex-col items-center gap-3 text-center">
              {logo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="" className="max-h-20 max-w-[80%] object-contain" />
              )}
              <span className="text-sm font-semibold text-slate-400">{KIND_LABEL[p.kind]}</span>
              <span className="text-xs text-slate-400">Obrázek zatím nemáme</span>
            </div>
          )}
        </div>
        <div>
          <h1 className="text-3xl font-black tracking-tight">{p.name}</h1>
          <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
            <dt className="text-slate-500">Typ</dt>
            <dd>{KIND_LABEL[p.kind]}</dd>
            {p.set && (
              <>
                <dt className="text-slate-500">Sada</dt>
                <dd>
                  <Link href={`/sady/${encodeURIComponent(p.set.id)}`} className="font-medium hover:underline">
                    {p.set.name}
                  </Link>
                </dd>
              </>
            )}
            <dt className="text-slate-500">Stav</dt>
            <dd>Originálně zapečetěno</dd>
            {wantCount > 0 && (
              <>
                <dt className="text-slate-500">Shání</dt>
                <dd>{wantCount} sběratelů</dd>
              </>
            )}
          </dl>
          <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Orientační cena</h2>
            <p className="mt-3 text-2xl font-bold">{price ? `≈ ${price}` : 'Cena zatím není k dispozici.'}</p>
            {p.priceStats && (
              <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-800">
                <PriceStatsTable stats={p.priceStats as PriceStats} title="Cardmarket" />
              </div>
            )}
            <PriceNote className="mt-4" />
            {eurCzkDate() && <p className="mt-1 text-xs text-slate-400">Kurz ČNB ze dne {eurCzkDate()}</p>}
          </section>
        </div>
      </div>

      {viewer ? (
        <section className="mt-8 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold">Moje sbírka</h2>
            {!mine.length && (
              <ActionForm action={toggleProductWant} className="flex items-center gap-2">
                <input type="hidden" name="productId" value={p.id} />
                <Submit variant={want ? 'primary' : 'ghost'}>{want ? '★ Sháním' : '☆ Sháním'}</Submit>
              </ActionForm>
            )}
          </div>
          {!mine.length && <ProductBuyForm productId={p.id} want={want} />}
          {mine.map((i) => (
            <ProductItemForm key={i.id} productId={p.id} item={i} />
          ))}
          <details open={!mine.length}>
            <summary className="cursor-pointer text-sm font-medium text-yellow-700 dark:text-yellow-400">
              {mine.length ? '+ Přidat v jiném jazyce' : 'Přidat do sbírky / nabídnout'}
            </summary>
            <div className="mt-3">
              <ProductItemForm
                productId={p.id}
                item={{ language: 'en', quantity: 1, spareQty: 0, offerType: null, priceCzk: null, note: null }}
              />
            </div>
          </details>
        </section>
      ) : (
        <p className="mt-8 rounded-xl bg-yellow-50 px-4 py-3 text-sm text-yellow-900 dark:bg-yellow-400/10 dark:text-yellow-100">
          <Link href="/prihlaseni" className="font-semibold underline">
            Přihlas se
          </Link>{' '}
          a přidej si produkt do sbírky, mezi hledané nebo ho nabídni.
        </p>
      )}

      <ProductBuyers productId={p.id} />

      <section className="mt-10">
        <h2 className="text-xl font-bold">Kdo ho nabízí</h2>
        {offers.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-slate-300 p-6 text-center text-slate-500 dark:border-slate-700">
            Zatím ho nikdo nenabízí.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            {offers.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/u/${encodeURIComponent(o.user.nickname)}`} className="font-semibold hover:underline">
                    {o.user.nickname}
                  </Link>
                  {viewer && viewer.id !== o.userId && (
                    <Link
                      href={`/u/${encodeURIComponent(o.user.nickname)}?nahlasit=1#nahlasit`}
                      className="ml-2 text-xs text-slate-400 hover:text-red-600 hover:underline"
                    >
                      nahlásit
                    </Link>
                  )}
                  <span className="text-sm text-slate-500"> · {o.user.city ?? o.user.region ?? 'neuvedeno'}</span>
                  <p className="text-xs text-slate-500">
                    {[o.language.toUpperCase(), o.spareQty > 1 && `${o.spareQty} ks`].filter(Boolean).join(' · ')}
                    {o.note && <span className="italic"> · „{o.note}“</span>}
                  </p>
                </div>
                <span className="flex items-center gap-3 font-semibold">
                  {o.offerType === 'SELL' && o.priceCzk != null
                    ? `${o.priceCzk.toLocaleString('cs-CZ')} Kč`
                    : o.offerType === 'GIFT'
                      ? 'Daruji za poštovné'
                      : 'Vyměním'}
                  {viewer && viewer.id !== o.userId && <AddToCart productItemId={o.id} />}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
