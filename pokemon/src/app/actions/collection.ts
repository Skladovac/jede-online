'use server'

import { revalidatePath } from 'next/cache'
import type { Condition, OfferType, Variant } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { str, type FormState } from '@/lib/validation'

const VARIANTS: Variant[] = ['NORMAL', 'HOLO', 'REVERSE', 'FIRST_EDITION']
const CONDITIONS: Condition[] = ['MINT', 'LIGHT_PLAYED', 'DAMAGED']
const OFFERS: OfferType[] = ['TRADE', 'SELL', 'GIFT']
const LANGS = ['en', 'de', 'fr', 'it', 'es', 'ja', 'ko', 'zh', 'other']

async function requireUser() {
  const user = await getCurrentUser()
  if (!user) throw new Error('Nepřihlášen')
  return user
}

/** Výchozí varianta pro rychlé odklikávání: ta, ve které karta opravdu vyšla. */
async function defaultVariant(cardId: string): Promise<Variant> {
  const c = await prisma.card.findUniqueOrThrow({ where: { id: cardId } })
  return c.hasNormal ? 'NORMAL' : c.hasHolo ? 'HOLO' : c.hasReverse ? 'REVERSE' : c.hasFirstEd ? 'FIRST_EDITION' : 'NORMAL'
}

export type QuickState = { owned: number; spare: number; want: boolean }

async function quickState(userId: string, cardId: string): Promise<QuickState> {
  const [items, want] = await Promise.all([
    prisma.collectionItem.findMany({ where: { userId, cardId }, select: { quantity: true, spareQty: true } }),
    prisma.wantItem.findFirst({ where: { userId, cardId } }),
  ])
  return {
    owned: items.reduce((s, i) => s + i.quantity, 0),
    spare: items.reduce((s, i) => s + i.spareQty, 0),
    want: !!want,
  }
}

/** Mřížka sady, režim "Mám": přepne mám / nemám (1 kus ve výchozí variantě). */
export async function toggleOwned(cardId: string): Promise<QuickState> {
  const user = await requireUser()
  const items = await prisma.collectionItem.findMany({ where: { userId: user.id, cardId } })
  if (items.length) {
    await prisma.collectionItem.deleteMany({ where: { userId: user.id, cardId } })
  } else {
    await prisma.collectionItem.create({ data: { userId: user.id, cardId, variant: await defaultVariant(cardId) } })
    // Co mám, už mi nechybí.
    await prisma.wantItem.deleteMany({ where: { userId: user.id, cardId } })
  }
  return quickState(user.id, cardId)
}

/** Režim "Chybí": přepne kartu na seznamu chybějících. */
export async function toggleWant(cardId: string): Promise<QuickState> {
  const user = await requireUser()
  const existing = await prisma.wantItem.findFirst({ where: { userId: user.id, cardId } })
  if (existing) await prisma.wantItem.deleteMany({ where: { userId: user.id, cardId } })
  else await prisma.wantItem.create({ data: { userId: user.id, cardId, variant: null } })
  return quickState(user.id, cardId)
}

/** Režim "Navíc": +1 / −1 kus navíc (nabízený k výměně). Kus navíc znamená i kus vlastněný. */
export async function changeSpare(cardId: string, delta: 1 | -1): Promise<QuickState> {
  const user = await requireUser()
  const items = await prisma.collectionItem.findMany({ where: { userId: user.id, cardId }, orderBy: { createdAt: 'asc' } })
  if (delta > 0) {
    const item =
      items[0] ??
      (await prisma.collectionItem.create({
        data: { userId: user.id, cardId, variant: await defaultVariant(cardId), quantity: 0 },
      }))
    const spare = item.spareQty + 1
    await prisma.collectionItem.update({
      where: { id: item.id },
      data: { spareQty: spare, quantity: Math.max(item.quantity, spare + 1), offerType: item.offerType ?? 'TRADE' },
    })
    await prisma.wantItem.deleteMany({ where: { userId: user.id, cardId } })
  } else {
    const item = [...items].reverse().find((i) => i.spareQty > 0)
    if (item) {
      const spare = item.spareQty - 1
      await prisma.collectionItem.update({
        where: { id: item.id },
        data: { spareQty: spare, quantity: item.quantity - 1, ...(spare === 0 && { offerType: null, priceCzk: null }) },
      })
    }
  }
  return quickState(user.id, cardId)
}

/** Podrobná úprava jednoho řádku sbírky na detailu karty. */
export async function saveItem(_: FormState, fd: FormData): Promise<FormState> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Přihlas se.' }
  const cardId = str(fd, 'cardId')
  const id = str(fd, 'id')
  const variant = str(fd, 'variant') as Variant
  const condition = str(fd, 'condition') as Condition
  const language = str(fd, 'language')
  const quantity = Number(str(fd, 'quantity'))
  const spareQty = Number(str(fd, 'spareQty') || 0)
  const offerRaw = str(fd, 'offerType')
  const offerType = spareQty > 0 ? ((offerRaw || 'TRADE') as OfferType) : null
  const priceRaw = str(fd, 'priceCzk')
  const priceCzk = offerType === 'SELL' ? Number(priceRaw) : null
  const note = str(fd, 'note')

  if (!VARIANTS.includes(variant) || !CONDITIONS.includes(condition) || !LANGS.includes(language))
    return { error: 'Neplatná varianta, stav nebo jazyk.' }
  if (offerType && !OFFERS.includes(offerType)) return { error: 'Neplatný typ nabídky.' }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) return { error: 'Počet kusů: 1–999.' }
  if (!Number.isInteger(spareQty) || spareQty < 0 || spareQty > quantity)
    return { error: 'Kusů navíc nemůže být víc než kusů celkem.' }
  if (offerType === 'SELL' && (!Number.isInteger(priceCzk) || priceCzk! < 1 || priceCzk! > 1_000_000))
    return { error: 'Zadej cenu v celých korunách.' }
  if (note.length > 30) return { error: 'Poznámka může mít nejvýš 30 znaků.' }

  const data = { variant, condition, language, quantity, spareQty, offerType, priceCzk, note: note || null }
  // Stejná varianta + stav + jazyk = jeden řádek; při kolizi kusy sečteme.
  const clash = await prisma.collectionItem.findFirst({
    where: { userId: user.id, cardId, variant, condition, language, ...(id && { id: { not: id } }) },
  })
  if (clash) {
    await prisma.collectionItem.update({
      where: { id: clash.id },
      data: { ...data, quantity: clash.quantity + quantity, spareQty: clash.spareQty + spareQty },
    })
    if (id) await prisma.collectionItem.deleteMany({ where: { id, userId: user.id } })
  } else if (id) {
    const res = await prisma.collectionItem.updateMany({ where: { id, userId: user.id }, data })
    if (!res.count) return { error: 'Položka nenalezena.' }
  } else {
    await prisma.collectionItem.create({ data: { ...data, userId: user.id, cardId } })
  }
  await prisma.wantItem.deleteMany({ where: { userId: user.id, cardId } })
  revalidatePath(`/karta/${cardId}`)
  return { ok: 'Uloženo.' }
}

export async function deleteItem(_: FormState, fd: FormData): Promise<FormState> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Přihlas se.' }
  await prisma.collectionItem.deleteMany({ where: { id: str(fd, 'id'), userId: user.id } })
  revalidatePath(`/karta/${str(fd, 'cardId')}`)
  return { ok: 'Odebráno ze sbírky.' }
}

export async function toggleWantForm(_: FormState, fd: FormData): Promise<FormState> {
  await toggleWant(str(fd, 'cardId'))
  revalidatePath(`/karta/${str(fd, 'cardId')}`)
  return undefined
}
