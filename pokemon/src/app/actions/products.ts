'use server'

import { revalidatePath } from 'next/cache'
import type { OfferType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { PRODUCT_LANGS } from '@/lib/products'
import { str, type FormState } from '@/lib/validation'

const OFFERS: OfferType[] = ['TRADE', 'SELL', 'GIFT']
const LANGS = PRODUCT_LANGS.map(([v]) => v)

/** Řádek sbírky produktu (jazyk) — přidání i úprava. Produkt je vždy zapečetěný. */
export async function saveProductItem(_: FormState, fd: FormData): Promise<FormState> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Přihlas se.' }
  const productId = Number(str(fd, 'productId'))
  const id = str(fd, 'id')
  const language = str(fd, 'language')
  const quantity = Number(str(fd, 'quantity'))
  const spareQty = Number(str(fd, 'spareQty') || 0)
  const offerType = spareQty > 0 ? ((str(fd, 'offerType') || 'SELL') as OfferType) : null
  if (spareQty > 0 && !user.emailVerifiedAt) return { error: 'Nabízet můžeš po potvrzení e-mailu (odkaz je v Můj účet).' }
  if (!Number.isInteger(productId) || productId < 1 || productId > 2_147_483_647) return { error: 'Produkt nenalezen.' }
  const priceCzk = offerType === 'SELL' ? Number(str(fd, 'priceCzk')) : null
  const note = str(fd, 'note')

  if (!(await prisma.product.findUnique({ where: { id: productId } }))) return { error: 'Produkt nenalezen.' }
  if (!LANGS.includes(language)) return { error: 'Neplatný jazyk.' }
  if (offerType && !OFFERS.includes(offerType)) return { error: 'Neplatný typ nabídky.' }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) return { error: 'Počet kusů: 1–999.' }
  if (!Number.isInteger(spareQty) || spareQty < 0 || spareQty > quantity)
    return { error: 'Kusů navíc nemůže být víc než kusů celkem.' }
  if (offerType === 'SELL' && (!Number.isInteger(priceCzk) || priceCzk! < 1 || priceCzk! > 1_000_000))
    return { error: 'Zadej cenu v celých korunách.' }
  if (note.length > 30) return { error: 'Poznámka může mít nejvýš 30 znaků.' }

  const data = { language, quantity, spareQty, offerType, priceCzk, note: note || null }
  const prev = id ? await prisma.productItem.findFirst({ where: { id, userId: user.id } }) : null
  const offerChanged = spareQty > 0 && (!prev || prev.spareQty === 0 || prev.offerType !== offerType || prev.priceCzk !== priceCzk)
  const stamp = offerChanged ? { offeredAt: new Date() } : {}
  const clash = await prisma.productItem.findFirst({
    where: { userId: user.id, productId, language, ...(id && { id: { not: id } }) },
  })
  if (clash) {
    await prisma.productItem.update({
      where: { id: clash.id },
      data: { ...data, ...stamp, quantity: clash.quantity + quantity, spareQty: clash.spareQty + spareQty },
    })
    if (id) await prisma.productItem.deleteMany({ where: { id, userId: user.id } })
  } else if (id) {
    const res = await prisma.productItem.updateMany({ where: { id, userId: user.id }, data: { ...data, ...stamp } })
    if (!res.count) return { error: 'Položka nenalezena.' }
  } else {
    await prisma.productItem.create({ data: { ...data, ...stamp, userId: user.id, productId } })
  }
  await prisma.productWant.deleteMany({ where: { userId: user.id, productId } })
  revalidatePath(`/produkt/${productId}`)
  return { ok: 'Uloženo.' }
}

export async function deleteProductItem(_: FormState, fd: FormData): Promise<FormState> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Přihlas se.' }
  await prisma.productItem.deleteMany({ where: { id: str(fd, 'id'), userId: user.id } })
  revalidatePath(`/produkt/${str(fd, 'productId')}`)
  return { ok: 'Odebráno ze sbírky.' }
}

export async function toggleProductWant(_: FormState, fd: FormData): Promise<FormState> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Přihlas se.' }
  const productId = Number(str(fd, 'productId'))
  const existing = await prisma.productWant.findFirst({ where: { userId: user.id, productId } })
  if (existing) await prisma.productWant.delete({ where: { id: existing.id } })
  else await prisma.productWant.create({ data: { userId: user.id, productId } })
  revalidatePath(`/produkt/${productId}`)
  return undefined
}
