'use server'

import { revalidatePath } from 'next/cache'
import type { Condition, Variant } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { str, type FormState } from '@/lib/validation'
import { getT } from '@/lib/i18n/server'

const VARIANTS: Variant[] = ['NORMAL', 'HOLO', 'REVERSE', 'FIRST_EDITION', 'POKEBALL', 'MASTERBALL']
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
  const t = await getT()
  const user = await getCurrentUser()
  if (!user) return { error: t('Přihlas se.') }
  const cardId = str(fd, 'cardId')
  const buy = fd.get('buy') === 'on'
  if (buy && !user.emailVerifiedAt) return { error: t('Poptávku „chci koupit“ můžeš zveřejnit po potvrzení e-mailu.') }
  const priceRes = parsePrice(str(fd, 'maxPriceCzk'))
  if ('error' in priceRes) return { error: t(priceRes.error) }
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
  // Čas zveřejnění poptávky jen když se nově zapnula nebo změnila cena.
  const stamp = buy && (!existing?.buy || existing.maxPriceCzk !== data.maxPriceCzk) ? { buyAt: new Date() } : {}
  if (existing) {
    // Jedna poptávka na kartu: případné další řádky (jiná varianta) sloučíme do první.
    await prisma.wantItem.deleteMany({ where: { userId: user.id, cardId, id: { not: existing.id } } })
    await prisma.wantItem.update({ where: { id: existing.id }, data: { ...data, ...stamp, variant } })
  } else {
    if (!(await prisma.card.findUnique({ where: { id: cardId }, select: { id: true } }))) return { error: t('Karta nenalezena.') }
    await prisma.wantItem.create({ data: { ...data, ...stamp, variant, userId: user.id, cardId } })
  }
  revalidatePath(`/karta/${cardId}`)
  return { ok: buy ? t('Uloženo. Ostatní uvidí, že tuhle kartu chceš koupit.') : t('Uloženo, karta zůstává mezi chybějícími.') }
}

/** „Chci koupit“ u produktu (ETB, booster box…). */
export async function saveProductBuy(_: FormState, fd: FormData): Promise<FormState> {
  const t = await getT()
  const user = await getCurrentUser()
  if (!user) return { error: t('Přihlas se.') }
  const productId = Number(str(fd, 'productId'))
  if (!Number.isInteger(productId) || productId < 1 || productId > 2_147_483_647) return { error: t('Produkt nenalezen.') }
  const buy = fd.get('buy') === 'on'
  if (buy && !user.emailVerifiedAt) return { error: t('Poptávku „chci koupit“ můžeš zveřejnit po potvrzení e-mailu.') }
  const priceRes = parsePrice(str(fd, 'maxPriceCzk'))
  if ('error' in priceRes) return { error: t(priceRes.error) }
  const data = { buy, maxPriceCzk: buy ? priceRes.price : null }
  const existing = await prisma.productWant.findUnique({ where: { userId_productId: { userId: user.id, productId } } })
  const stamp = buy && (!existing?.buy || existing.maxPriceCzk !== data.maxPriceCzk) ? { buyAt: new Date() } : {}
  await prisma.productWant.upsert({
    where: { userId_productId: { userId: user.id, productId } },
    create: { ...data, ...stamp, userId: user.id, productId },
    update: { ...data, ...stamp },
  })
  revalidatePath(`/produkt/${productId}`)
  return { ok: buy ? t('Uloženo. Ostatní uvidí, že tenhle produkt chceš koupit.') : t('Uloženo.') }
}
