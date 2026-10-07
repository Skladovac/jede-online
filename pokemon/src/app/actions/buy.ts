'use server'

import { revalidatePath } from 'next/cache'
import type { Condition, Variant } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { str, type FormState } from '@/lib/validation'

const VARIANTS: Variant[] = ['NORMAL', 'HOLO', 'REVERSE', 'FIRST_EDITION']
const CONDITIONS: Condition[] = ['MINT', 'LIGHT_PLAYED', 'DAMAGED']
const LANGS = ['en', 'de', 'fr', 'it', 'es', 'ja', 'ko', 'zh', 'other']

function parsePrice(raw: string): { price: number | null } | { error: string } {
  if (!raw) return { price: null }
  const n = Number(raw.replace(/\s/g, ''))
  if (!Number.isInteger(n) || n < 1 || n > 1_000_000) return { error: 'Cenu zadej v celých korunách (nebo nech prázdnou).' }
  return { price: n }
}

/**
 * „Chci koupit“ u chybějící karty: veřejná poptávka s nejvyšší cenou a podmínkami.
 * Když karta ještě není mezi chybějícími, přidá ji tam. buy=off poptávku zruší (karta dál chybí).
 */
export async function saveCardBuy(_: FormState, fd: FormData): Promise<FormState> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Přihlas se.' }
  const cardId = str(fd, 'cardId')
  const buy = fd.get('buy') === 'on'
  const priceRes = parsePrice(str(fd, 'maxPriceCzk'))
  if ('error' in priceRes) return { error: priceRes.error }
  const variantRaw = str(fd, 'variant') as Variant
  const conditionRaw = str(fd, 'minCondition') as Condition
  const languageRaw = str(fd, 'language')
  const data = {
    buy,
    maxPriceCzk: buy ? priceRes.price : null,
    minCondition: buy && CONDITIONS.includes(conditionRaw) ? conditionRaw : null,
    language: buy && LANGS.includes(languageRaw) ? languageRaw : null,
  }
  const variant = VARIANTS.includes(variantRaw) ? variantRaw : null

  const existing = await prisma.wantItem.findFirst({ where: { userId: user.id, cardId }, orderBy: { createdAt: 'asc' } })
  if (existing) {
    // Jedna poptávka na kartu: případné další řádky (jiná varianta) sloučíme do první.
    await prisma.wantItem.deleteMany({ where: { userId: user.id, cardId, id: { not: existing.id } } })
    await prisma.wantItem.update({ where: { id: existing.id }, data: { ...data, variant } })
  } else {
    if (!(await prisma.card.findUnique({ where: { id: cardId }, select: { id: true } }))) return { error: 'Karta nenalezena.' }
    await prisma.wantItem.create({ data: { ...data, variant, userId: user.id, cardId } })
  }
  revalidatePath(`/karta/${cardId}`)
  return { ok: buy ? 'Uloženo. Ostatní uvidí, že tuhle kartu chceš koupit.' : 'Uloženo, karta zůstává mezi chybějícími.' }
}

/** „Chci koupit“ u produktu (ETB, booster box…). */
export async function saveProductBuy(_: FormState, fd: FormData): Promise<FormState> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Přihlas se.' }
  const productId = Number(str(fd, 'productId'))
  if (!Number.isInteger(productId)) return { error: 'Produkt nenalezen.' }
  const buy = fd.get('buy') === 'on'
  const priceRes = parsePrice(str(fd, 'maxPriceCzk'))
  if ('error' in priceRes) return { error: priceRes.error }
  const data = { buy, maxPriceCzk: buy ? priceRes.price : null }
  await prisma.productWant.upsert({
    where: { userId_productId: { userId: user.id, productId } },
    create: { ...data, userId: user.id, productId },
    update: data,
  })
  revalidatePath(`/produkt/${productId}`)
  return { ok: buy ? 'Uloženo. Ostatní uvidí, že tenhle produkt chceš koupit.' : 'Uloženo.' }
}
