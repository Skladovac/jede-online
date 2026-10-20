import 'server-only'
import type { Condition, OfferType, Variant } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { searchCards } from '@/lib/search'
import { notifyDeals } from '@/lib/deals'
import { rateLimit } from '@/lib/rate-limit'
import { setDisplayName } from '@/lib/format'
import type { ApiUser } from '@/lib/api-auth'

/**
 * Zápis do sbírky přes AI asistenty (MCP i REST). Stejná pravidla jako web:
 * jen vlastní sbírka, nabídky jen s ověřeným e-mailem (děti po souhlasu rodiče),
 * kusů navíc nejvýš tolik, kolik jich mám. Limit 60 zápisů za minutu na klíč.
 *
 * Když má karta víc variant a AI žádnou neposlala, nic se neuloží a vrátí se `needs_variant`
 * se seznamem — asistent se má uživatele zeptat a zavolat znovu.
 */
const SITE = 'https://pokemon.jede.online'
export const MAX_BATCH = 20
export const WRITE_PER_MIN = 60

const VARIANTS: Variant[] = ['NORMAL', 'HOLO', 'REVERSE', 'FIRST_EDITION', 'POKEBALL', 'MASTERBALL']
const CONDITIONS: Condition[] = ['MINT', 'LIGHT_PLAYED', 'DAMAGED']
const OFFERS: OfferType[] = ['TRADE', 'SELL', 'GIFT']
const LANGS = ['en', 'de', 'fr', 'it', 'es', 'ja', 'ko', 'zh', 'other']
export const VARIANT_LABEL: Record<Variant, string> = { NORMAL: 'normální', HOLO: 'holo', REVERSE: 'reverse holo', FIRST_EDITION: '1st edition', POKEBALL: 'Poké Ball reverse', MASTERBALL: 'Master Ball reverse' }

export type WriteError = { error: string; status?: number }
export class WriteFail extends Error {
  constructor(message: string, public status = 400) {
    super(message)
  }
}

export function checkWriteLimit(user: ApiUser) {
  if (!rateLimit(`api-w:${user.tokenId}`, WRITE_PER_MIN, 60_000)) throw new WriteFail('Příliš mnoho zápisů, zkus to za minutu.', 429)
}

type CardRow = Awaited<ReturnType<typeof findCard>>
async function findCard(cardId: string) {
  return prisma.card.findUnique({
    where: { id: cardId },
    select: { id: true, name: true, localId: true, hasNormal: true, hasHolo: true, hasReverse: true, hasFirstEd: true, hasPokeball: true, hasMasterball: true, set: { select: { id: true, name: true, code: true, officialCount: true } } },
  })
}

function availableVariants(c: NonNullable<CardRow>): Variant[] {
  const v: Variant[] = []
  if (c.hasNormal) v.push('NORMAL')
  if (c.hasHolo) v.push('HOLO')
  if (c.hasReverse) v.push('REVERSE')
  if (c.hasFirstEd) v.push('FIRST_EDITION')
  if (c.hasPokeball) v.push('POKEBALL')
  if (c.hasMasterball) v.push('MASTERBALL')
  return v.length ? v : ['NORMAL']
}

const ref = (c: NonNullable<CardRow>) => ({
  id: c.id,
  name: c.name,
  number: `${c.set.code ? `${c.set.code} ` : ''}${c.localId}${c.set.officialCount ? `/${c.set.officialCount}` : ''}`,
  set: setDisplayName(c.set),
  url: `${SITE}/karta/${encodeURIComponent(c.id)}`,
})

const variantOptions = (c: NonNullable<CardRow>) => availableVariants(c).map((v) => ({ variant: v, label: VARIANT_LABEL[v] }))

/** Karta podle id, nebo podle dotazu („CEL CC025“, „Charizard 199/165“). Víc shod = `ambiguous`, ať si asistent vybere / zeptá se. */
async function resolveCard(input: { cardId?: string | null; query?: string | null }) {
  if (input.cardId) {
    const c = await findCard(input.cardId)
    return c ? { card: c } : { fail: { status: 'not_found' as const, query: input.cardId, message: 'Karta s tímto id neexistuje.' } }
  }
  const q = (input.query ?? '').trim()
  if (q.length < 2) return { fail: { status: 'not_found' as const, query: q, message: 'Zadej cardId nebo query (kód sady a číslo, např. „SVI 045“).' } }
  const hits = await searchCards(q, 8)
  if (!hits.length) return { fail: { status: 'not_found' as const, query: q, message: 'Nic jsme nenašli. Zkus kód sady a číslo (např. „SVI 045“) nebo použij search_cards.' } }
  if (hits.length > 1)
    return {
      fail: {
        status: 'ambiguous' as const,
        query: q,
        message: 'Víc karet odpovídá — zeptej se uživatele, kterou myslí, a zavolej znovu s cardId.',
        candidates: hits.map((h) => ({ id: h.id, name: h.name, number: `${h.set.code ? `${h.set.code} ` : ''}${h.localId}${h.set.officialCount ? `/${h.set.officialCount}` : ''}`, set: setDisplayName({ id: h.id.replace(/-[^-]+$/, ''), name: h.set.name }) })),
      },
    }
  const c = await findCard(hits[0].id)
  return c ? { card: c } : { fail: { status: 'not_found' as const, query: q, message: 'Karta nenalezena.' } }
}

/** Varianta: musí být jedna z těch, ve kterých karta vyšla. Chybí-li a karta má víc variant → `needs_variant`. */
function pickVariant(c: NonNullable<CardRow>, wanted?: string | null) {
  const avail = availableVariants(c)
  if (wanted) {
    const v = wanted.toUpperCase().replace(/[\s-]/g, '_') as Variant
    if (!VARIANTS.includes(v)) return { fail: { status: 'needs_variant' as const, card: ref(c), options: variantOptions(c), message: `Neznámá varianta „${wanted}“. Použij jednu z options.` } }
    if (!avail.includes(v)) return { fail: { status: 'needs_variant' as const, card: ref(c), options: variantOptions(c), message: `Tahle karta nevyšla jako ${VARIANT_LABEL[v]}. Zeptej se uživatele, kterou z options má.` } }
    return { variant: v }
  }
  if (avail.length === 1) return { variant: avail[0] }
  return { fail: { status: 'needs_variant' as const, card: ref(c), options: variantOptions(c), message: 'Karta existuje ve více variantách — zeptej se uživatele, kterou má (normální / holo / reverse holo…), a zavolej znovu s variant.' } }
}

function normCondition(s?: string | null): Condition {
  if (!s) return 'MINT'
  const v = s.toUpperCase().replace(/[\s-]/g, '_')
  if (v === 'NM' || v === 'NEAR_MINT' || v === 'MINT') return 'MINT'
  if (v === 'LP' || v === 'PLAYED' || v === 'LIGHT_PLAYED' || v === 'LIGHTLY_PLAYED') return 'LIGHT_PLAYED'
  if (v === 'DMG' || v === 'DAMAGED' || v === 'HP' || v === 'HEAVILY_PLAYED' || v === 'POOR') return 'DAMAGED'
  if (CONDITIONS.includes(v as Condition)) return v as Condition
  throw new WriteFail(`Neznámý stav „${s}“. Použij MINT, LIGHT_PLAYED nebo DAMAGED.`)
}
function normLang(s?: string | null) {
  const v = (s ?? 'en').toLowerCase()
  if (!LANGS.includes(v)) throw new WriteFail(`Neznámý jazyk „${s}“. Použij: ${LANGS.join(', ')}.`)
  return v
}

async function ownedTotal(userId: string, cardId: string) {
  const r = await prisma.collectionItem.aggregate({ where: { userId, cardId }, _sum: { quantity: true } })
  return r._sum.quantity ?? 0
}

/** Upozornění do zvonečku (bez push), ať je vidět, co AI udělala. Zápisy během 15 minut se slučují do jednoho řádku. */
async function logAi(userId: string, text: string) {
  try {
    const since = new Date(Date.now() - 15 * 60_000)
    const last = await prisma.notification.findFirst({ where: { userId, icon: '🤖', readAt: null, createdAt: { gte: since } }, orderBy: { createdAt: 'desc' } })
    if (last) {
      const body = `${last.body ?? ''}\n${text}`.trim().slice(-500)
      await prisma.notification.update({ where: { id: last.id }, data: { body, createdAt: new Date() } })
    } else {
      await prisma.notification.create({ data: { userId, title: 'Tvůj AI asistent upravil sbírku', body: text.slice(0, 500), url: '/sbirka', icon: '🤖' } })
    }
  } catch (err) {
    console.error('[ai-log]', err)
  }
}

// ── Přidání karet ──

export type AddItem = { cardId?: string | null; query?: string | null; quantity?: number | null; variant?: string | null; condition?: string | null; language?: string | null; note?: string | null }

export async function aiAddCards(user: ApiUser, items: AddItem[]) {
  checkWriteLimit(user)
  if (!items.length) throw new WriteFail('Pošli aspoň jednu kartu.')
  if (items.length > MAX_BATCH) throw new WriteFail(`Nejvýš ${MAX_BATCH} karet na jedno volání.`)
  const results: unknown[] = []
  const added: string[] = []
  for (const it of items) {
    const qty = it.quantity ?? 1
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
      results.push({ status: 'error', query: it.query ?? it.cardId, message: 'quantity: 1–99' })
      continue
    }
    const r = await resolveCard(it)
    if ('fail' in r) {
      results.push(r.fail)
      continue
    }
    const pv = pickVariant(r.card, it.variant)
    if ('fail' in pv) {
      results.push(pv.fail)
      continue
    }
    const condition = normCondition(it.condition)
    const language = normLang(it.language)
    const note = (it.note ?? '').slice(0, 30) || null
    const existing = await prisma.collectionItem.findFirst({ where: { userId: user.id, cardId: r.card.id, variant: pv.variant, condition, language } })
    if (existing) await prisma.collectionItem.update({ where: { id: existing.id }, data: { quantity: Math.min(existing.quantity + qty, 999), ...(note && { note }) } })
    else await prisma.collectionItem.create({ data: { userId: user.id, cardId: r.card.id, variant: pv.variant, condition, language, quantity: qty, note } })
    // Co mám, už mi nechybí (poptávka na jinou variantu zůstává).
    await prisma.wantItem.deleteMany({ where: { userId: user.id, cardId: r.card.id, OR: [{ variant: null }, { variant: pv.variant }] } })
    const total = await ownedTotal(user.id, r.card.id)
    results.push({ status: 'added', card: ref(r.card), quantity: qty, variant: pv.variant, variantLabel: VARIANT_LABEL[pv.variant], condition, language, ownedTotal: total })
    added.push(`+${qty}× ${r.card.name} (${ref(r.card).number}, ${VARIANT_LABEL[pv.variant]})`)
  }
  if (added.length) await logAi(user.id, added.join(', '))
  return { results, addedCount: added.length, collectionUrl: `${SITE}/sbirka` }
}

// ── Počet kusů / odebrání ──

export async function aiSetQuantity(user: ApiUser, input: { cardId?: string | null; query?: string | null; quantity: number; variant?: string | null; condition?: string | null; language?: string | null }) {
  checkWriteLimit(user)
  const qty = input.quantity
  if (!Number.isInteger(qty) || qty < 0 || qty > 999) throw new WriteFail('quantity: 0–999 (0 = odebrat ze sbírky).')
  const r = await resolveCard(input)
  if ('fail' in r) return r.fail
  const rows = await prisma.collectionItem.findMany({ where: { userId: user.id, cardId: r.card.id }, orderBy: { createdAt: 'asc' } })
  const match = rows.filter(
    (x) => (!input.variant || x.variant === input.variant.toUpperCase().replace(/[\s-]/g, '_')) && (!input.condition || x.condition === normCondition(input.condition)) && (!input.language || x.language === normLang(input.language)),
  )
  if (!match.length) {
    if (qty === 0) return { status: 'unchanged', card: ref(r.card), message: 'Kartu ve sbírce nemáš (v této variantě).', ownedTotal: await ownedTotal(user.id, r.card.id) }
    // Nový řádek: stejná pravidla jako přidání.
    const pv = pickVariant(r.card, input.variant)
    if ('fail' in pv) return pv.fail
    await prisma.collectionItem.create({ data: { userId: user.id, cardId: r.card.id, variant: pv.variant, condition: normCondition(input.condition), language: normLang(input.language), quantity: qty } })
    await prisma.wantItem.deleteMany({ where: { userId: user.id, cardId: r.card.id, OR: [{ variant: null }, { variant: pv.variant }] } })
    await logAi(user.id, `${r.card.name}: ${qty} ks (${VARIANT_LABEL[pv.variant]})`)
    return { status: 'set', card: ref(r.card), quantity: qty, variant: pv.variant, ownedTotal: await ownedTotal(user.id, r.card.id) }
  }
  if (match.length > 1 && qty > 0)
    return {
      status: 'needs_variant',
      card: ref(r.card),
      message: 'Kartu máš ve více řádcích (varianta / stav / jazyk) — upřesni, který měnit.',
      options: match.map((x) => ({ variant: x.variant, label: VARIANT_LABEL[x.variant], condition: x.condition, language: x.language, quantity: x.quantity })),
    }
  if (qty === 0) {
    await prisma.collectionItem.deleteMany({ where: { id: { in: match.map((x) => x.id) }, userId: user.id } })
    await logAi(user.id, `odebráno: ${r.card.name} (${ref(r.card).number})`)
    return { status: 'removed', card: ref(r.card), removedRows: match.length, ownedTotal: await ownedTotal(user.id, r.card.id) }
  }
  const row = match[0]
  await prisma.collectionItem.update({ where: { id: row.id }, data: { quantity: qty, spareQty: Math.min(row.spareQty, qty) } })
  await logAi(user.id, `${r.card.name}: ${row.quantity} → ${qty} ks`)
  return { status: 'set', card: ref(r.card), quantity: qty, variant: row.variant, ownedTotal: await ownedTotal(user.id, r.card.id) }
}

// ── Chybí / nechybí ──

export type MissingItem = { cardId?: string | null; query?: string | null }

export async function aiMarkMissing(user: ApiUser, items: MissingItem[], opts: { buy?: boolean | null; maxPriceCzk?: number | null }) {
  checkWriteLimit(user)
  if (!items.length) throw new WriteFail('Pošli aspoň jednu kartu.')
  if (items.length > MAX_BATCH) throw new WriteFail(`Nejvýš ${MAX_BATCH} karet na jedno volání.`)
  const buy = !!opts.buy
  const maxPriceCzk = opts.maxPriceCzk ?? null
  if (maxPriceCzk !== null && (!Number.isInteger(maxPriceCzk) || maxPriceCzk < 1 || maxPriceCzk > 1_000_000)) throw new WriteFail('maxPriceCzk: celé koruny 1–1 000 000.')
  if (buy && !user.emailVerifiedAt) throw new WriteFail('Veřejnou poptávku „koupím“ jde zadat až po potvrzení e-mailu.', 403)
  const results: unknown[] = []
  const names: string[] = []
  for (const it of items) {
    const r = await resolveCard(it)
    if ('fail' in r) {
      results.push(r.fail)
      continue
    }
    const owned = await ownedTotal(user.id, r.card.id)
    const existing = await prisma.wantItem.findFirst({ where: { userId: user.id, cardId: r.card.id } })
    const data = buy ? { buy: true, maxPriceCzk, buyAt: new Date() } : {}
    if (existing) await prisma.wantItem.update({ where: { id: existing.id }, data })
    else await prisma.wantItem.create({ data: { userId: user.id, cardId: r.card.id, variant: null, ...data } })
    results.push({ status: existing ? 'already_missing' : 'marked_missing', card: ref(r.card), buy, maxPriceCzk, note: owned ? `Pozor: kartu máš ve sbírce (${owned} ks) — označil jsi ji jako chybějící (třeba jiná varianta).` : undefined })
    names.push(r.card.name)
  }
  if (names.length) await logAi(user.id, `chybí: ${names.join(', ')}`)
  return { results, missingUrl: `${SITE}/sbirka?view=hledam` }
}

export async function aiUnmarkMissing(user: ApiUser, items: MissingItem[]) {
  checkWriteLimit(user)
  if (!items.length) throw new WriteFail('Pošli aspoň jednu kartu.')
  if (items.length > MAX_BATCH) throw new WriteFail(`Nejvýš ${MAX_BATCH} karet na jedno volání.`)
  const results: unknown[] = []
  for (const it of items) {
    const r = await resolveCard(it)
    if ('fail' in r) {
      results.push(r.fail)
      continue
    }
    const del = await prisma.wantItem.deleteMany({ where: { userId: user.id, cardId: r.card.id } })
    results.push({ status: del.count ? 'unmarked' : 'was_not_missing', card: ref(r.card) })
  }
  return { results }
}

// ── Nabídky (kusy navíc) ──

export async function aiSetOffer(user: ApiUser, input: { cardId?: string | null; query?: string | null; spare: number; offerType: string; priceCzk?: number | null; variant?: string | null; condition?: string | null; language?: string | null }) {
  checkWriteLimit(user)
  if (!user.emailVerifiedAt) throw new WriteFail('Nabízet kusy navíc jde až po potvrzení e-mailu (odkaz je v Můj účet).', 403)
  if (user.isMinor && !user.parentConsentAt) throw new WriteFail('Nabídky jsou u dětského účtu dostupné až po souhlasu rodiče.', 403)
  const offerType = input.offerType.toUpperCase() as OfferType
  if (!OFFERS.includes(offerType)) throw new WriteFail('offerType: TRADE (vyměním), SELL (prodám) nebo GIFT (daruji za poštovné).')
  if (!Number.isInteger(input.spare) || input.spare < 1 || input.spare > 999) throw new WriteFail('spare: 1–999 kusů navíc.')
  const priceCzk = offerType === 'SELL' ? (input.priceCzk ?? null) : null
  if (offerType === 'SELL' && (priceCzk === null || !Number.isInteger(priceCzk) || priceCzk < 1 || priceCzk > 1_000_000)) throw new WriteFail('U prodeje zadej priceCzk v celých korunách.')
  const r = await resolveCard(input)
  if ('fail' in r) return r.fail
  const rows = await prisma.collectionItem.findMany({ where: { userId: user.id, cardId: r.card.id } })
  const match = rows.filter(
    (x) => (!input.variant || x.variant === input.variant.toUpperCase().replace(/[\s-]/g, '_')) && (!input.condition || x.condition === normCondition(input.condition)) && (!input.language || x.language === normLang(input.language)),
  )
  if (!match.length) return { status: 'not_owned', card: ref(r.card), message: 'Kartu ve sbírce nemáš — nejdřív ji přidej (add_cards), pak nabídni.' }
  if (match.length > 1)
    return { status: 'needs_variant', card: ref(r.card), message: 'Kartu máš ve více řádcích — upřesni variantu / stav / jazyk.', options: match.map((x) => ({ variant: x.variant, label: VARIANT_LABEL[x.variant], condition: x.condition, language: x.language, quantity: x.quantity })) }
  const row = match[0]
  const spareQty = Math.min(input.spare, row.quantity)
  const changed = row.spareQty === 0 || row.offerType !== offerType || row.priceCzk !== priceCzk
  await prisma.collectionItem.update({ where: { id: row.id }, data: { spareQty, offerType, priceCzk, ...(changed && { offeredAt: new Date() }) } })
  if (changed) await notifyDeals([row.id])
  await logAi(user.id, `nabídka: ${r.card.name} ${spareQty} ks ${offerType === 'SELL' ? `za ${priceCzk} Kč` : offerType === 'TRADE' ? 'na výměnu' : 'zdarma'}`)
  return { status: 'offered', card: ref(r.card), spare: spareQty, offerType, priceCzk, note: spareQty < input.spare ? `Nabízet jde nejvýš tolik, kolik máš (${row.quantity}).` : undefined, url: `${SITE}/sbirka/nabidka` }
}

export async function aiClearOffer(user: ApiUser, input: { cardId?: string | null; query?: string | null }) {
  checkWriteLimit(user)
  const r = await resolveCard(input)
  if ('fail' in r) return r.fail
  const res = await prisma.collectionItem.updateMany({ where: { userId: user.id, cardId: r.card.id, spareQty: { gt: 0 } }, data: { spareQty: 0, offerType: null, priceCzk: null } })
  if (res.count) await logAi(user.id, `nabídka zrušena: ${r.card.name}`)
  return { status: res.count ? 'cleared' : 'no_offer', card: ref(r.card) }
}
