import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { EXPORT_HEADER, toCsv } from '@/lib/csv'

export const dynamic = 'force-dynamic'

/** Export sbírky do CSV (Excel): karty, zapečetěné produkty a seznam chybějících. Jen vlastní data. */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Přihlas se.' }, { status: 401 })

  const [items, products, wants, productWants] = await Promise.all([
    prisma.collectionItem.findMany({
      where: { userId: user.id },
      include: { card: { include: { set: { select: { name: true, code: true } } } } },
      orderBy: [{ card: { setId: 'asc' } }, { card: { localId: 'asc' } }],
    }),
    prisma.productItem.findMany({ where: { userId: user.id }, include: { product: { select: { id: true, name: true } } } }),
    prisma.wantItem.findMany({
      where: { userId: user.id },
      include: { card: { include: { set: { select: { name: true, code: true } } } } },
      orderBy: [{ card: { setId: 'asc' } }, { card: { localId: 'asc' } }],
    }),
    prisma.productWant.findMany({ where: { userId: user.id }, include: { product: { select: { id: true, name: true } } } }),
  ])

  const rows: (string | number | null)[][] = [EXPORT_HEADER]
  for (const i of items)
    rows.push([
      'karta',
      i.card.set.name,
      i.card.set.code,
      i.card.localId,
      i.card.name,
      i.variant,
      i.condition,
      i.language,
      i.quantity,
      i.spareQty,
      i.offerType,
      i.priceCzk,
      i.purchasePriceCzk,
      i.note,
      i.cardId,
    ])
  for (const p of products)
    rows.push(['produkt', '', '', '', p.product.name, '', '', p.language, p.quantity, p.spareQty, p.offerType, p.priceCzk, p.purchasePriceCzk, p.note, String(p.productId)])
  for (const w of wants)
    rows.push([
      'chybi',
      w.card.set.name,
      w.card.set.code,
      w.card.localId,
      w.card.name,
      w.variant,
      w.minCondition,
      w.language,
      '',
      '',
      w.buy ? 'KOUPIM' : '',
      w.maxPriceCzk,
      '',
      '',
      w.cardId,
    ])
  for (const w of productWants)
    rows.push(['chybi-produkt', '', '', '', w.product.name, '', '', '', '', '', w.buy ? 'KOUPIM' : '', w.maxPriceCzk, '', '', String(w.productId)])

  const day = new Date().toISOString().slice(0, 10)
  return new NextResponse(toCsv(rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="pokemon-sbirka-${encodeURIComponent(user.nickname)}-${day}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
