import 'server-only'
import { prisma } from '@/lib/prisma'
import { ensureEurCzk, eurCzkRate } from '@/lib/fx'

/**
 * Hodnota sbírky („portfolio“): orientační cena z Cardmarketu × počet kusů podle varianty
 * (reverse a Poké/Master Ball reverse mají cenu reverse), včetně kusů navíc a zapečetěných produktů.
 * Stav karty se nezohledňuje. Investováno = nákupní cena za kus × kusy (jen kde ji majitel zadal).
 */

const REVERSE_LIKE = new Set(['REVERSE', 'POKEBALL', 'MASTERBALL'])

/** Dnešní den v českém čase jako datum (pro denní snímky). */
export function pragueDay(d = new Date()) {
  const s = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague' }).format(d)
  return new Date(`${s}T00:00:00Z`)
}

export async function portfolio(userId: string) {
  await ensureEurCzk()
  const rate = eurCzkRate() ?? 25
  const [items, products] = await Promise.all([
    prisma.collectionItem.findMany({
      where: { userId, quantity: { gt: 0 } },
      select: {
        quantity: true,
        variant: true,
        purchasePriceCzk: true,
        createdAt: true,
        card: {
          select: {
            id: true,
            name: true,
            localId: true,
            imageUrl: true,
            priceEur: true,
            priceReverseEur: true,
            set: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.productItem.findMany({
      where: { userId, quantity: { gt: 0 } },
      select: { quantity: true, purchasePriceCzk: true, product: { select: { id: true, name: true, priceEur: true } } },
    }),
  ])

  let valueEur = 0
  let investedCzk = 0
  let investedValueEur = 0 // současná hodnota jen těch kusů, u kterých je zadaná nákupní cena (férový zisk/ztráta)
  const bySet = new Map<string, { id: string; name: string; eur: number }>()
  const cards: { id: string; name: string; localId: string; imageUrl: string | null; set: string; unitEur: number; qty: number }[] = []

  for (const i of items) {
    const unit = Number((REVERSE_LIKE.has(i.variant) ? i.card.priceReverseEur ?? i.card.priceEur : i.card.priceEur) ?? 0)
    const total = unit * i.quantity
    valueEur += total
    if (i.purchasePriceCzk != null) {
      investedCzk += i.purchasePriceCzk * i.quantity
      investedValueEur += total
    }
    const s = bySet.get(i.card.set.id) ?? { id: i.card.set.id, name: i.card.set.name, eur: 0 }
    s.eur += total
    bySet.set(i.card.set.id, s)
    if (unit > 0)
      cards.push({
        id: i.card.id,
        name: i.card.name,
        localId: i.card.localId,
        imageUrl: i.card.imageUrl,
        set: i.card.set.name,
        unitEur: unit,
        qty: i.quantity,
      })
  }
  let productsEur = 0
  for (const p of products) {
    const total = Number(p.product.priceEur ?? 0) * p.quantity
    productsEur += total
    valueEur += total
    if (p.purchasePriceCzk != null) {
      investedCzk += p.purchasePriceCzk * p.quantity
      investedValueEur += total
    }
  }

  const czk = (eur: number) => Math.round(eur * rate)
  return {
    rate,
    valueEur,
    valueCzk: czk(valueEur),
    productsCzk: czk(productsEur),
    investedCzk,
    investedValueCzk: czk(investedValueEur),
    topCards: cards.sort((a, b) => b.unitEur - a.unitEur).slice(0, 6).map((c) => ({ ...c, unitCzk: czk(c.unitEur) })),
    bySet: [...bySet.values()]
      .filter((s) => s.eur > 0)
      .sort((a, b) => b.eur - a.eur)
      .slice(0, 8)
      .map((s) => ({ ...s, czk: czk(s.eur) })),
  }
}

/** Uloží dnešní snímek hodnoty (graf vývoje). Volá přehled při otevření a noční cron pro všechny. */
export async function saveSnapshot(userId: string, valueCzk: number, investedCzk: number) {
  const day = pragueDay()
  await prisma.valueSnapshot.upsert({
    where: { userId_day: { userId, day } },
    create: { userId, day, valueCzk, investedCzk },
    update: { valueCzk, investedCzk },
  })
}

/** Noční snímky pro všechny, kdo mají něco ve sbírce (po obnově cen). */
export async function snapshotAll(log: (m: string) => void = console.log) {
  const users = await prisma.user.findMany({
    where: { bannedAt: null, OR: [{ items: { some: {} } }, { productItems: { some: {} } }] },
    select: { id: true },
  })
  for (const u of users) {
    const p = await portfolio(u.id)
    await saveSnapshot(u.id, p.valueCzk, p.investedCzk)
  }
  log(`[portfolio] snímky hodnoty: ${users.length}`)
}
