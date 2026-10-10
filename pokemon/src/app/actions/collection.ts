'use server'

import { revalidatePath } from 'next/cache'
import type { Condition, OfferType, Variant } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { str, type FormState } from '@/lib/validation'
import { getT } from '@/lib/i18n/server'
import { searchCards, searchCardsById } from '@/lib/search'

const VARIANTS: Variant[] = ['NORMAL', 'HOLO', 'REVERSE', 'FIRST_EDITION', 'POKEBALL', 'MASTERBALL']
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

export type QuickState = { owned: number; spare: number; want: boolean; error?: string }

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
    const variant = await defaultVariant(cardId)
    await prisma.collectionItem.create({ data: { userId: user.id, cardId, variant } })
    // Co mám, už mi nechybí (poptávka na jinou variantu — např. reverse do master setu — zůstává).
    await prisma.wantItem.deleteMany({ where: { userId: user.id, cardId, OR: [{ variant: null }, { variant }] } })
  }
  return quickState(user.id, cardId)
}

/** Režim "Chybí": přepne kartu na seznamu chybějících. */
export async function toggleWant(cardId: string): Promise<QuickState> {
  const user = await requireUser()
  const existing = await prisma.wantItem.findFirst({ where: { userId: user.id, cardId } })
  if (existing) await prisma.wantItem.deleteMany({ where: { userId: user.id, cardId } })
  else
    await prisma.wantItem.create({ data: { userId: user.id, cardId, variant: null } }).catch(() => {
      // Dvojklik: řádek už mezitím vznikl (unikátní index) — výsledek je stejný.
    })
  return quickState(user.id, cardId)
}

/** Režim "Navíc": +1 / −1 kus navíc (nabízený k výměně). Kus navíc znamená i kus vlastněný. */
export async function changeSpare(cardId: string, delta: 1 | -1): Promise<QuickState> {
  const t = await getT()
  const user = await requireUser()
  const items = await prisma.collectionItem.findMany({ where: { userId: user.id, cardId }, orderBy: { createdAt: 'asc' } })
  if (delta > 0) {
    if (!user.emailVerifiedAt)
      return { ...(await quickState(user.id, cardId)), error: t('Kusy navíc můžeš nabízet po potvrzení e-mailu (odkaz je v Můj účet).') }
    const item =
      items[0] ??
      (await prisma.collectionItem.create({
        data: { userId: user.id, cardId, variant: await defaultVariant(cardId), quantity: 0 },
      }))
    const spare = item.spareQty + 1
    await prisma.collectionItem.update({
      where: { id: item.id },
      data: {
        spareQty: spare,
        quantity: Math.max(item.quantity, spare + 1),
        offerType: item.offerType ?? 'TRADE',
        // Nová nabídka (dosud nic navíc) = čas zveřejnění; další kus navíc nabídku neposouvá.
        ...(item.spareQty === 0 && { offeredAt: new Date() }),
      },
    })
    await prisma.wantItem.deleteMany({ where: { userId: user.id, cardId, OR: [{ variant: null }, { variant: item.variant }] } })
  } else {
    const item = [...items].reverse().find((i) => i.spareQty > 0)
    if (item) {
      const spare = item.spareQty - 1
      const quantity = item.quantity - 1
      // Poslední kus pryč = karta už ve sbírce není (řádek s 0 kusy by se pořád počítal jako „mám“).
      if (quantity <= 0) await prisma.collectionItem.delete({ where: { id: item.id } })
      else
        await prisma.collectionItem.update({
          where: { id: item.id },
          data: { spareQty: spare, quantity, ...(spare === 0 && { offerType: null, priceCzk: null }) },
        })
    }
  }
  return quickState(user.id, cardId)
}

/** Podrobná úprava jednoho řádku sbírky na detailu karty. */
export async function saveItem(_: FormState, fd: FormData): Promise<FormState> {
  const t = await getT()
  const user = await getCurrentUser()
  if (!user) return { error: t('Přihlas se.') }
  const cardId = str(fd, 'cardId')
  const id = str(fd, 'id')
  const variant = str(fd, 'variant') as Variant
  const condition = str(fd, 'condition') as Condition
  const language = str(fd, 'language')
  const quantity = Number(str(fd, 'quantity'))
  const spareQty = Number(str(fd, 'spareQty') || 0)
  const offerRaw = str(fd, 'offerType')
  const offerType = spareQty > 0 ? ((offerRaw || 'TRADE') as OfferType) : null
  // Nabízet může jen ověřený e-mail (jinak by šlo zakládat nabídky na cizí adresu).
  if (spareQty > 0 && !user.emailVerifiedAt) return { error: t('Kusy navíc můžeš nabízet po potvrzení e-mailu (odkaz je v Můj účet).') }
  const priceRaw = str(fd, 'priceCzk')
  const priceCzk = offerType === 'SELL' ? Number(priceRaw) : null
  const note = str(fd, 'note')

  if (!VARIANTS.includes(variant) || !CONDITIONS.includes(condition) || !LANGS.includes(language))
    return { error: t('Neplatná varianta, stav nebo jazyk.') }
  if (offerType && !OFFERS.includes(offerType)) return { error: t('Neplatný typ nabídky.') }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) return { error: t('Počet kusů: 1–999.') }
  if (!Number.isInteger(spareQty) || spareQty < 0 || spareQty > quantity)
    return { error: t('Kusů navíc nemůže být víc než kusů celkem.') }
  if (offerType === 'SELL' && (!Number.isInteger(priceCzk) || priceCzk! < 1 || priceCzk! > 1_000_000))
    return { error: t('Zadej cenu v celých korunách.') }
  if (note.length > 30) return { error: t('Poznámka může mít nejvýš 30 znaků.') }

  // Nákupní cena za kus (nepovinná, vidí jen majitel).
  const purchaseRaw = str(fd, 'purchasePriceCzk').replace(/\s/g, '')
  const purchasePriceCzk = purchaseRaw ? Number(purchaseRaw) : null
  if (purchasePriceCzk !== null && (!Number.isInteger(purchasePriceCzk) || purchasePriceCzk < 0 || purchasePriceCzk > 10_000_000))
    return { error: t('Nákupní cenu zadej v celých korunách (nebo nech prázdnou).') }
  const data = { variant, condition, language, quantity, spareQty, offerType, priceCzk, note: note || null, purchasePriceCzk }
  // Čas zveřejnění nabídky jen při skutečné změně (nově navíc, jiný typ nebo cena), ne při úpravě poznámky.
  const prev = id ? await prisma.collectionItem.findFirst({ where: { id, userId: user.id } }) : null
  const offerChanged = spareQty > 0 && (!prev || prev.spareQty === 0 || prev.offerType !== offerType || prev.priceCzk !== priceCzk)
  const stamp = offerChanged ? { offeredAt: new Date() } : {}
  // Stejná varianta + stav + jazyk = jeden řádek; při kolizi kusy sečteme.
  const clash = await prisma.collectionItem.findFirst({
    where: { userId: user.id, cardId, variant, condition, language, ...(id && { id: { not: id } }) },
  })
  if (clash) {
    const total = Math.min(clash.quantity + quantity, 999)
    await prisma.collectionItem.update({
      where: { id: clash.id },
      data: { ...data, ...stamp, quantity: total, spareQty: Math.min(clash.spareQty + spareQty, total) },
    })
    if (id) {
      // Rozpracované poptávky na slučovaný řádek přesměrovat, ať se po výměně kusy odečtou.
      await prisma.tradeRequestItem.updateMany({ where: { collectionItemId: id }, data: { collectionItemId: clash.id } })
      await prisma.collectionItem.deleteMany({ where: { id, userId: user.id } })
    }
  } else if (id) {
    const res = await prisma.collectionItem.updateMany({ where: { id, userId: user.id }, data: { ...data, ...stamp } })
    if (!res.count) return { error: t('Položka nenalezena.') }
  } else {
    await prisma.collectionItem.create({ data: { ...data, ...stamp, userId: user.id, cardId } })
  }
  await prisma.wantItem.deleteMany({ where: { userId: user.id, cardId, OR: [{ variant: null }, { variant }] } })
  revalidatePath(`/karta/${cardId}`)
  return { ok: t('Uloženo.') }
}

export async function deleteItem(_: FormState, fd: FormData): Promise<FormState> {
  const t = await getT()
  const user = await getCurrentUser()
  if (!user) return { error: t('Přihlas se.') }
  await prisma.collectionItem.deleteMany({ where: { id: str(fd, 'id'), userId: user.id } })
  revalidatePath(`/karta/${str(fd, 'cardId')}`)
  return { ok: t('Odebráno ze sbírky.') }
}

/** Číslo karty v základní sadě (1–oficiální počet); secret rare a TG/GG/SV podsady mají číslo vyšší nebo s písmeny. */
function isBaseCard(localId: string, officialCount: number) {
  return /^\d+$/.test(localId) && Number(localId) >= 1 && Number(localId) <= officialCount
}

/**
 * „Vše, co nemám, mi chybí“: všechny karty sady, které uživatel nevlastní, dá mezi chybějící.
 * onlyBase = jen základní karty (bez secret rare). Vrací id karet, které teď chybí.
 */
export async function markRestWanted(setId: string, onlyBase: boolean): Promise<string[]> {
  const user = await requireUser()
  const set = await prisma.cardSet.findUniqueOrThrow({
    where: { id: setId },
    include: { cards: { select: { id: true, localId: true } } },
  })
  const [owned, wanted] = await Promise.all([
    prisma.collectionItem.findMany({ where: { userId: user.id, card: { setId } }, select: { cardId: true } }),
    prisma.wantItem.findMany({ where: { userId: user.id, card: { setId } }, select: { cardId: true } }),
  ])
  const skip = new Set([...owned, ...wanted].map((x) => x.cardId))
  const toAdd = set.cards
    .filter((c) => !skip.has(c.id))
    .filter((c) => !onlyBase || !set.officialCount || isBaseCard(c.localId, set.officialCount))
  if (toAdd.length)
    await prisma.wantItem.createMany({ data: toAdd.map((c) => ({ userId: user.id, cardId: c.id, variant: null })), skipDuplicates: true })
  return [...new Set([...wanted.map((w) => w.cardId), ...toAdd.map((c) => c.id)])]
}

/**
 * Rychlé označení podle čísel: „1, 5, 23-30, 145, TG05“.
 * kind=owned → přidá do sbírky (1 kus ve výchozí variantě, z chybějících zmizí), kind=want → mezi chybějící.
 * Vrací id karet, kterých se to týkalo, a čísla, která v sadě nejsou.
 */
export async function markByNumbers(
  setId: string,
  text: string,
  kind: 'owned' | 'want',
): Promise<{ ids: string[]; notFound: string[] }> {
  const user = await requireUser()
  const cards = await prisma.card.findMany({
    where: { setId },
    select: { id: true, localId: true, hasNormal: true, hasHolo: true, hasReverse: true, hasFirstEd: true },
  })
  // Číselná čísla porovnáváme jako čísla („5“ = „005“), ostatní (TG05, SV001) přesně bez ohledu na velikost písmen.
  const byNum = new Map<number, (typeof cards)[number]>()
  const byText = new Map<string, (typeof cards)[number]>()
  for (const c of cards) {
    if (/^\d+$/.test(c.localId)) byNum.set(Number(c.localId), c)
    byText.set(c.localId.toUpperCase(), c)
  }
  const picked = new Map<string, (typeof cards)[number]>()
  const notFound: string[] = []
  for (const raw of text.split(/[\s,;]+/).filter(Boolean).slice(0, 500)) {
    const range = raw.match(/^(\d+)\s*[-–]\s*(\d+)$/)
    if (range) {
      const [a, b] = [Number(range[1]), Number(range[2])].sort((x, y) => x - y)
      if (b - a > 500) continue
      for (let n = a; n <= b; n++) {
        const c = byNum.get(n)
        if (c) picked.set(c.id, c)
      }
      continue
    }
    const c = /^\d+$/.test(raw) ? byNum.get(Number(raw)) : byText.get(raw.toUpperCase())
    if (c) picked.set(c.id, c)
    else notFound.push(raw)
  }
  const list = [...picked.values()]
  if (!list.length) return { ids: [], notFound }
  const ids = list.map((c) => c.id)

  if (kind === 'owned') {
    const have = new Set(
      (await prisma.collectionItem.findMany({ where: { userId: user.id, cardId: { in: ids } }, select: { cardId: true } })).map(
        (i) => i.cardId,
      ),
    )
    const toCreate = list.filter((c) => !have.has(c.id))
    if (toCreate.length)
      await prisma.collectionItem.createMany({
        data: toCreate.map((c) => ({
          userId: user.id,
          cardId: c.id,
          variant: c.hasNormal ? 'NORMAL' : c.hasHolo ? 'HOLO' : c.hasReverse ? 'REVERSE' : c.hasFirstEd ? 'FIRST_EDITION' : 'NORMAL',
        })),
        skipDuplicates: true,
      })
    await prisma.wantItem.deleteMany({ where: { userId: user.id, cardId: { in: ids } } })
  } else {
    const skip = new Set(
      [
        ...(await prisma.collectionItem.findMany({ where: { userId: user.id, cardId: { in: ids } }, select: { cardId: true } })),
        ...(await prisma.wantItem.findMany({ where: { userId: user.id, cardId: { in: ids } }, select: { cardId: true } })),
      ].map((x) => x.cardId),
    )
    const toCreate = ids.filter((id) => !skip.has(id))
    if (toCreate.length)
      await prisma.wantItem.createMany({ data: toCreate.map((cardId) => ({ userId: user.id, cardId, variant: null })), skipDuplicates: true })
  }
  return { ids, notFound }
}

/** Zruší všechny chybějící karty v sadě. */
export async function clearSetWanted(setId: string): Promise<void> {
  const user = await requireUser()
  await prisma.wantItem.deleteMany({ where: { userId: user.id, card: { setId } } })
}

export async function toggleWantForm(_: FormState, fd: FormData): Promise<FormState> {
  await toggleWant(str(fd, 'cardId'))
  revalidatePath(`/karta/${str(fd, 'cardId')}`)
  return undefined
}

// ── Rychlé přidání karty číslem (Moje sbírka) ──

export type QuickHit = { id: string; name: string; number: string; set: string; imageUrl: string | null; owned: number }
export type QuickBatch = { added: (QuickHit & { qty: number })[]; ambiguous: { q: string; hits: QuickHit[] }[]; notFound: string[] }
export type QuickAddState = { added?: QuickHit; hits?: QuickHit[]; batch?: QuickBatch; error?: string; q?: string }

async function toHits(userId: string, cards: Awaited<ReturnType<typeof searchCards>>): Promise<QuickHit[]> {
  const owned = await prisma.collectionItem.groupBy({
    by: ['cardId'],
    where: { userId, cardId: { in: cards.map((c) => c.id) } },
    _sum: { quantity: true },
  })
  return cards.map((c) => ({
    id: c.id,
    name: c.name,
    number: `${c.set.code ? `${c.set.code} ` : ''}${c.localId}${c.set.officialCount ? `/${c.set.officialCount}` : ''}`,
    set: c.set.name,
    imageUrl: c.imageUrl,
    owned: owned.find((o) => o.cardId === c.id)?._sum.quantity ?? 0,
  }))
}

/** +1 kus karty ve výchozí variantě (a karta tím přestane chybět). */
async function addPiece(userId: string, cardId: string) {
  const variant = await defaultVariant(cardId)
  const existing = await prisma.collectionItem.findFirst({ where: { userId, cardId, variant, condition: 'MINT', language: 'en' } })
  if (existing) await prisma.collectionItem.update({ where: { id: existing.id }, data: { quantity: { increment: 1 } } })
  else await prisma.collectionItem.create({ data: { userId, cardId, variant } })
  await prisma.wantItem.deleteMany({ where: { userId, cardId, OR: [{ variant: null }, { variant }] } })
}

/**
 * Napíšeš číslo z karty („MEP 101“, „30C 071“, „045/198“) nebo jméno: jedna shoda se rovnou přidá,
 * víc shod se nabídne k výběru.
 */
export async function quickAdd(_: QuickAddState, fd: FormData): Promise<QuickAddState> {
  const t = await getT()
  const user = await requireUser()
  const pick = str(fd, 'cardId')
  if (pick) {
    const card = await prisma.card.findUnique({ where: { id: pick }, select: { id: true } })
    if (!card) return { error: t('Karta nenalezena.') }
    await addPiece(user.id, card.id)
    revalidatePath('/sbirka')
    const [hit] = await toHits(user.id, await searchCardsById(card.id))
    return { added: hit }
  }
  const q = str(fd, 'q').trim()
  if (q.length < 2) return { error: t('Napiš číslo z karty, např. MEP 101 nebo 045/198.'), q }
  // Seznam najednou: „MEP 101, SVI 045; 2x 30C 071“ (oddělené čárkou, středníkem nebo novým řádkem).
  if (/[,;\n]/.test(q)) {
    const items = q.split(/[,;\n]+/).map((x) => x.trim()).filter((x) => x.length >= 2).slice(0, 100)
    const batch: QuickBatch = { added: [], ambiguous: [], notFound: [] }
    for (const raw of items) {
      const m = raw.match(/^(\d{1,2})\s*[x×]\s*(.+)$/i)
      const qty = m ? Math.min(20, Number(m[1])) : 1
      const term = m ? m[2] : raw
      const cards = await searchCards(term, 8)
      if (!cards.length) batch.notFound.push(raw)
      else if (cards.length > 1) batch.ambiguous.push({ q: raw, hits: await toHits(user.id, cards) })
      else {
        for (let i = 0; i < qty; i++) await addPiece(user.id, cards[0].id)
        const [hit] = await toHits(user.id, cards)
        batch.added.push({ ...hit, qty })
      }
    }
    if (batch.added.length) revalidatePath('/sbirka')
    return { batch }
  }
  const cards = await searchCards(q, 8)
  if (!cards.length) return { error: t('Nic jsme nenašli. Zkus kód sady a číslo, např. SVI 045.'), q }
  if (cards.length === 1) {
    await addPiece(user.id, cards[0].id)
    revalidatePath('/sbirka')
    const [hit] = await toHits(user.id, cards)
    return { added: hit }
  }
  return { hits: await toHits(user.id, cards), q }
}

// ── Hromadná nabídka (Moje sbírka → Hromadná nabídka) ──

/**
 * Vybraným řádkům sbírky nastaví nabídku najednou (nebo ji zruší). Pravidla stejná jako u jedné karty:
 * nabízet jde jen s ověřeným e-mailem, kusů navíc nejvýš tolik, kolik jich mám, prodej s cenou v Kč.
 */
export async function bulkOffer(_: FormState, fd: FormData): Promise<FormState> {
  const t = await getT()
  const user = await requireUser()
  const ids = fd.getAll('ids').map(String).filter(Boolean).slice(0, 2000)
  if (!ids.length) return { error: t('Vyber aspoň jednu kartu.') }
  const items = await prisma.collectionItem.findMany({ where: { id: { in: ids }, userId: user.id }, select: { id: true, quantity: true, spareQty: true, offerType: true, priceCzk: true } })
  if (str(fd, 'mode') === 'clear') {
    await prisma.collectionItem.updateMany({ where: { id: { in: items.map((i) => i.id) } }, data: { spareQty: 0, offerType: null, priceCzk: null } })
    revalidatePath('/sbirka')
    revalidatePath('/sbirka/nabidka')
    return { ok: t('Nabídka zrušena u {n} karet.', { n: items.length }) }
  }
  if (!user.emailVerifiedAt) return { error: t('Kusy navíc můžeš nabízet po potvrzení e-mailu (odkaz je v Můj účet).') }
  const offerType = str(fd, 'offerType') as OfferType
  if (!OFFERS.includes(offerType)) return { error: t('Neplatný typ nabídky.') }
  const spare = Number(str(fd, 'spare'))
  if (!Number.isInteger(spare) || spare < 1 || spare > 999) return { error: t('Kusů navíc: 1–999.') }
  const priceCzk = offerType === 'SELL' ? Number(str(fd, 'priceCzk')) : null
  if (offerType === 'SELL' && (!Number.isInteger(priceCzk) || priceCzk! < 1 || priceCzk! > 1_000_000))
    return { error: t('Zadej cenu v celých korunách.') }
  const now = new Date()
  await prisma.$transaction(
    items.map((i) => {
      const spareQty = Math.min(spare, i.quantity)
      const changed = i.spareQty === 0 || i.offerType !== offerType || i.priceCzk !== priceCzk
      return prisma.collectionItem.update({
        where: { id: i.id },
        data: { spareQty, offerType, priceCzk, ...(changed && { offeredAt: now }) },
      })
    }),
  )
  revalidatePath('/sbirka')
  revalidatePath('/sbirka/nabidka')
  return { ok: t('Nabídka uložena u {n} karet.', { n: items.length }) }
}
