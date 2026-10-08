'use server'

import { revalidatePath } from 'next/cache'
import type { Condition, OfferType, Variant } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, isLimited } from '@/lib/auth'
import { parseCsv } from '@/lib/csv'
import { rateLimit } from '@/lib/rate-limit'
import type { FormState } from '@/lib/validation'
import { getT } from '@/lib/i18n/server'

const VARIANTS: Variant[] = ['NORMAL', 'HOLO', 'REVERSE', 'FIRST_EDITION', 'POKEBALL', 'MASTERBALL']
const CONDITIONS: Condition[] = ['MINT', 'LIGHT_PLAYED', 'DAMAGED']
const OFFERS: OfferType[] = ['TRADE', 'SELL', 'GIFT']
const LANGS = ['en', 'de', 'fr', 'it', 'es', 'ja', 'ko', 'zh', 'other']
const MAX_ROWS = 5000

const key = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '')
const int = (s: string | undefined, min = 0, max = 1_000_000) => {
  const n = Number((s ?? '').replace(/\s/g, ''))
  return s && Number.isInteger(n) && n >= min && n <= max ? n : null
}

/**
 * Import sbírky z CSV: buď soubor z našeho exportu (i upravený v Excelu), nebo jednoduchý seznam
 * „kód sady (nebo název) ; číslo karty ; kusů“. Stejná karta + varianta + stav + jazyk se přepíše
 * (počet kusů se nastaví podle souboru), nic se nemaže.
 */
export async function importCollection(_: FormState, fd: FormData): Promise<FormState> {
  const t = await getT()
  const user = await getCurrentUser()
  if (!user) return { error: t('Přihlas se.') }
  if (!rateLimit(`import:${user.id}`, 10, 60 * 60_000)) return { error: t('Příliš mnoho importů. Zkus to za hodinu.') }
  const file = fd.get('file')
  if (!(file instanceof File) || !file.size) return { error: t('Vyber soubor CSV.') }
  if (file.size > 2_000_000) return { error: t('Soubor je moc velký (max. 2 MB).') }

  const rows = parseCsv(await file.text())
  if (!rows.length) return { error: t('Soubor je prázdný.') }
  const head = rows[0].map(key)
  const hasHeader = head.some((h) => ['typ', 'cislo', 'sada', 'kodsady', 'id', 'kusu'].includes(h))
  const col = (name: string) => head.indexOf(key(name))
  const data = (hasHeader ? rows.slice(1) : rows).slice(0, MAX_ROWS)
  // Bez hlavičky: sada ; číslo ; kusů
  const get = (r: string[], name: string) => {
    if (hasHeader) {
      const i = col(name)
      return i >= 0 ? r[i] ?? '' : ''
    }
    return { sada: r[0], cislo: r[1], kusu: r[2] ?? '1' }[name] ?? ''
  }

  const sets = await prisma.cardSet.findMany({ select: { id: true, name: true, code: true } })
  const setBy = new Map<string, string>()
  for (const s of sets) {
    setBy.set(key(s.name), s.id)
    if (s.code) setBy.set(key(s.code), s.id)
    setBy.set(key(s.id), s.id)
  }
  type CatalogCard = { id: string; localId: string; hasNormal: boolean; hasHolo: boolean; hasReverse: boolean; hasFirstEd: boolean }
  const cardSelect = { id: true, localId: true, hasNormal: true, hasHolo: true, hasReverse: true, hasFirstEd: true } as const
  const cardCache = new Map<string, CatalogCard[]>()
  async function cardsOf(setId: string) {
    if (!cardCache.has(setId)) cardCache.set(setId, await prisma.card.findMany({ where: { setId }, select: cardSelect }))
    return cardCache.get(setId)!
  }
  async function findCard(r: string[]): Promise<CatalogCard | null> {
    const id = get(r, 'id')
    if (id) {
      const c = await prisma.card.findUnique({ where: { id }, select: cardSelect })
      if (c) return c
    }
    const setId = setBy.get(key(get(r, 'kod_sady'))) ?? setBy.get(key(get(r, 'sada')))
    const num = get(r, 'cislo').split('/')[0].trim()
    if (!setId || !num) return null
    const list = await cardsOf(setId)
    // Číslo přesně (TG05, 045), nebo číselně (5 = 005).
    return (
      list.find((c) => c.localId.toUpperCase() === num.toUpperCase()) ??
      (/^\d+$/.test(num) ? list.find((c) => /^\d+$/.test(c.localId) && Number(c.localId) === Number(num)) : undefined) ??
      null
    )
  }

  const verified = !!user.emailVerifiedAt && !isLimited(user)
  let cards = 0
  let wants = 0
  let products = 0
  const errors: string[] = []
  for (const [n, r] of data.entries()) {
    const line = n + (hasHeader ? 2 : 1)
    const typ = key(get(r, 'typ') || 'karta')
    try {
      if (typ === 'produkt' || typ === 'chybiprodukt') {
        const productId = int(get(r, 'id'), 1, 2_147_483_647)
        if (!productId || !(await prisma.product.findUnique({ where: { id: productId }, select: { id: true } }))) {
          errors.push(t('řádek {line}: produkt nenalezen', { line }))
          continue
        }
        if (typ === 'chybiprodukt') {
          const buy = key(get(r, 'nabidka')) === 'koupim'
          await prisma.productWant.upsert({
            where: { userId_productId: { userId: user.id, productId } },
            create: { userId: user.id, productId, buy: buy && verified, maxPriceCzk: buy ? int(get(r, 'cena_kc'), 1) : null, ...(buy && verified && { buyAt: new Date() }) },
            update: {},
          })
          wants++
          continue
        }
        const language = LANGS.includes(get(r, 'jazyk').toLowerCase()) ? get(r, 'jazyk').toLowerCase() : 'en'
        const quantity = int(get(r, 'kusu'), 1, 999) ?? 1
        const spareQty = verified ? Math.min(int(get(r, 'navic'), 0, 999) ?? 0, quantity) : 0
        const offerType = spareQty > 0 ? (OFFERS.includes(get(r, 'nabidka').toUpperCase() as OfferType) ? (get(r, 'nabidka').toUpperCase() as OfferType) : 'SELL') : null
        const priceCzk = offerType === 'SELL' ? int(get(r, 'cena_kc'), 1) : null
        const row = { quantity, spareQty, offerType: offerType === 'SELL' && !priceCzk ? 'TRADE' : offerType, priceCzk, purchasePriceCzk: int(get(r, 'koupeno_za_kc')), note: get(r, 'poznamka').slice(0, 30) || null }
        await prisma.productItem.upsert({
          where: { userId_productId_language: { userId: user.id, productId, language } },
          create: { ...row, userId: user.id, productId, language, ...(spareQty > 0 && { offeredAt: new Date() }) },
          update: row,
        })
        products++
        continue
      }

      const card = await findCard(r)
      if (!card) {
        errors.push(t('řádek {line}: karta nenalezena ({ref})', { line, ref: [get(r, 'kod_sady') || get(r, 'sada'), get(r, 'cislo')].filter(Boolean).join(' ') }))
        continue
      }
      if (typ === 'chybi') {
        const owned = await prisma.collectionItem.findFirst({ where: { userId: user.id, cardId: card.id }, select: { id: true } })
        if (owned) continue // co mám, už mi nechybí
        const buy = key(get(r, 'nabidka')) === 'koupim'
        const exists = await prisma.wantItem.findFirst({ where: { userId: user.id, cardId: card.id } })
        if (!exists)
          await prisma.wantItem.create({
            data: {
              userId: user.id,
              cardId: card.id,
              variant: null,
              buy: buy && verified,
              maxPriceCzk: buy ? int(get(r, 'cena_kc'), 1) : null,
              ...(buy && verified && { buyAt: new Date() }),
            },
          })
        wants++
        continue
      }

      const defVariant: Variant = card.hasNormal ? 'NORMAL' : card.hasHolo ? 'HOLO' : card.hasReverse ? 'REVERSE' : card.hasFirstEd ? 'FIRST_EDITION' : 'NORMAL'
      const v = get(r, 'varianta').toUpperCase()
      const variant = VARIANTS.includes(v as Variant) ? (v as Variant) : defVariant
      const c = get(r, 'stav').toUpperCase()
      const condition = CONDITIONS.includes(c as Condition) ? (c as Condition) : 'MINT'
      const language = LANGS.includes(get(r, 'jazyk').toLowerCase()) ? get(r, 'jazyk').toLowerCase() : 'en'
      const quantity = int(get(r, 'kusu'), 1, 999) ?? 1
      // Nabídky jen s ověřeným e-mailem (stejně jako ve formuláři).
      const spareQty = verified ? Math.min(int(get(r, 'navic'), 0, 999) ?? 0, quantity) : 0
      const o = get(r, 'nabidka').toUpperCase()
      let offerType: OfferType | null = spareQty > 0 ? (OFFERS.includes(o as OfferType) ? (o as OfferType) : 'TRADE') : null
      const priceCzk = offerType === 'SELL' ? int(get(r, 'cena_kc'), 1) : null
      if (offerType === 'SELL' && !priceCzk) offerType = 'TRADE'
      const row = { quantity, spareQty, offerType, priceCzk, purchasePriceCzk: int(get(r, 'koupeno_za_kc')), note: get(r, 'poznamka').slice(0, 30) || null }
      await prisma.collectionItem.upsert({
        where: { userId_cardId_variant_condition_language: { userId: user.id, cardId: card.id, variant, condition, language } },
        create: { ...row, userId: user.id, cardId: card.id, variant, condition, language, ...(spareQty > 0 && { offeredAt: new Date() }) },
        update: row,
      })
      await prisma.wantItem.deleteMany({ where: { userId: user.id, cardId: card.id, OR: [{ variant: null }, { variant }] } })
      cards++
    } catch {
      errors.push(t('řádek {line}: nepodařilo se uložit', { line }))
    }
  }
  revalidatePath('/sbirka')
  const parts = [cards && t('{n}× karta', { n: cards }), products && t('{n}× produkt', { n: products }), wants && t('{n}× chybí', { n: wants })].filter(Boolean)
  const msg = `${t('Hotovo: {parts}.', { parts: parts.length ? parts.join(', ') : t('nic nového') })}${rows.length - (hasHeader ? 1 : 0) > MAX_ROWS ? ` ${t('Načteno jen prvních {max} řádků.', { max: MAX_ROWS })}` : ''}`
  return errors.length
    ? { ok: `${msg} ${t('Nenačteno {count}:', { count: errors.length })} ${errors.slice(0, 12).join('; ')}${errors.length > 12 ? '…' : ''}` }
    : { ok: msg }
}
