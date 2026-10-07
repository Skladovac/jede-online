'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { CollectionItem, RatingTag, User } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, isLimited } from '@/lib/auth'
import { APP_URL, esc, notify } from '@/lib/email'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { str, type FormState } from '@/lib/validation'

const VARIANT = { NORMAL: 'Normální', HOLO: 'Holo', REVERSE: 'Reverse holo', FIRST_EDITION: '1st edition' } as const
const CONDITION = { MINT: 'jako nová', LIGHT_PLAYED: 'mírně hraná', DAMAGED: 'poškozená' } as const
const OFFER = { TRADE: 'výměna', SELL: 'prodej', GIFT: 'dar za poštovné' } as const
const TAGS: RatingTag[] = ['FAST_SHIPPING', 'AS_DESCRIBED', 'FRIENDLY', 'SLOW', 'NOT_AS_DESCRIBED', 'NOT_SENT']

type FullItem = CollectionItem & { card: { name: string; localId: string; imageUrl: string | null; set: { name: string } } }

/** Kopie rodiči u nezletilého (PRD: o každé poptávce ví i rodič). */
const parentCc = (u: Pick<User, 'isMinor' | 'parentEmail'>) => (u.isMinor && u.parentEmail ? [u.parentEmail] : [])
const visible = (u: User) => !u.bannedAt && !isLimited(u)

function snapshot(i: FullItem) {
  return {
    cardId: i.cardId,
    title: `${i.card.name} (${i.card.set.name} ${i.card.localId})`,
    detail: [VARIANT[i.variant], CONDITION[i.condition], i.language.toUpperCase(), i.note && `„${i.note}“`]
      .filter(Boolean)
      .join(' · '),
    imageUrl: i.card.imageUrl,
    offerType: i.offerType,
    priceCzk: i.offerType === 'SELL' ? i.priceCzk : null,
  }
}

async function requireUser() {
  const user = await getCurrentUser()
  if (!user) redirect('/prihlaseni')
  return user
}

const itemInclude = { card: { select: { name: true, localId: true, imageUrl: true, set: { select: { name: true } } } } }

// ── Košík ──────────────────────────────────────────────────────────

/** "Chci" u nabídky: přidá kus do košíku (rozpracované poptávky) u daného prodávajícího. */
export async function addToCart(_: FormState, fd: FormData): Promise<FormState> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Nejdřív se přihlas.' }
  const item = await prisma.collectionItem.findUnique({
    where: { id: str(fd, 'collectionItemId') },
    include: { ...itemInclude, user: true },
  })
  if (!item || item.spareQty < 1 || !item.offerType || !visible(item.user)) return { error: 'Nabídka už neplatí.' }
  if (item.userId === user.id) return { error: 'Tohle je tvoje vlastní nabídka.' }

  const draft =
    (await prisma.tradeRequest.findFirst({ where: { fromId: user.id, toId: item.userId, status: 'DRAFT' } })) ??
    (await prisma.tradeRequest.create({ data: { fromId: user.id, toId: item.userId } }))
  const existing = await prisma.tradeRequestItem.findFirst({
    where: { requestId: draft.id, collectionItemId: item.id, fromRequester: false },
  })
  if (existing) {
    if (existing.quantity >= item.spareQty) return { ok: 'Už máš v košíku všechny nabízené kusy.' }
    await prisma.tradeRequestItem.update({ where: { id: existing.id }, data: { quantity: existing.quantity + 1 } })
  } else {
    await prisma.tradeRequestItem.create({
      data: { requestId: draft.id, collectionItemId: item.id, fromRequester: false, ...snapshot(item) },
    })
  }
  revalidatePath('/', 'layout')
  return { ok: 'Přidáno do košíku.' }
}

export async function setCartQty(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser()
  const row = await prisma.tradeRequestItem.findUnique({
    where: { id: str(fd, 'itemId') },
    include: { request: true, collectionItem: true },
  })
  if (!row || row.request.fromId !== user.id || row.request.status !== 'DRAFT') return { error: 'Položka nenalezena.' }
  const qty = Number(str(fd, 'quantity'))
  if (qty <= 0) {
    await prisma.tradeRequestItem.delete({ where: { id: row.id } })
    // Prázdný košík u prodávajícího zmizí.
    if (!(await prisma.tradeRequestItem.count({ where: { requestId: row.requestId, fromRequester: false } })))
      await prisma.tradeRequest.delete({ where: { id: row.requestId } })
  } else {
    const max = row.collectionItem?.spareQty ?? 0
    await prisma.tradeRequestItem.update({ where: { id: row.id }, data: { quantity: Math.min(qty, Math.max(max, 1)) } })
  }
  revalidatePath('/', 'layout')
  return undefined
}

/** Kupující nabídne na výměnu svůj kus navíc (jen kusy navíc ze své sbírky). */
export async function offerMyItem(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser()
  const req = await prisma.tradeRequest.findUnique({ where: { id: str(fd, 'requestId') } })
  if (!req || req.fromId !== user.id || req.status !== 'DRAFT') return { error: 'Poptávka nenalezena.' }
  const mine = await prisma.collectionItem.findUnique({ where: { id: str(fd, 'collectionItemId') }, include: itemInclude })
  if (!mine || mine.userId !== user.id || mine.spareQty < 1) return { error: 'Vyber svůj kus navíc.' }
  const existing = await prisma.tradeRequestItem.findFirst({
    where: { requestId: req.id, collectionItemId: mine.id, fromRequester: true },
  })
  if (existing) return { ok: 'Už je nabídnutý.' }
  await prisma.tradeRequestItem.create({
    data: { requestId: req.id, collectionItemId: mine.id, fromRequester: true, ...snapshot(mine), offerType: 'TRADE', priceCzk: null },
  })
  revalidatePath('/kosik')
  return undefined
}

// ── Odeslání a odpověď ─────────────────────────────────────────────

export async function sendRequest(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser()
  if (isLimited(user)) return { error: 'Poptávky půjde posílat, až rodič potvrdí tvůj účet.' }
  if (!user.emailVerifiedAt) return { error: 'Nejdřív potvrď svůj e-mail (odkaz najdeš na stránce Můj účet).' }
  if (!rateLimit(`request:${user.id}`, 20, 24 * 60 * 60_000)) return { error: 'Dnes už jsi poslal(a) hodně poptávek.' }

  const req = await prisma.tradeRequest.findUnique({
    where: { id: str(fd, 'requestId') },
    include: { to: true, items: { include: { collectionItem: { include: itemInclude } } } },
  })
  if (!req || req.fromId !== user.id || req.status !== 'DRAFT') return { error: 'Poptávka nenalezena.' }
  if (!visible(req.to)) return { error: 'Tento uživatel teď poptávky nepřijímá.' }

  // Aktualizovat snapshot podle současného stavu nabídek; zmizelé položky vyřadit.
  for (const it of req.items) {
    const ci = it.collectionItem
    if (!ci || ci.spareQty < 1 || (!it.fromRequester && !ci.offerType)) {
      await prisma.tradeRequestItem.delete({ where: { id: it.id } })
      continue
    }
    await prisma.tradeRequestItem.update({
      where: { id: it.id },
      data: {
        ...snapshot(ci),
        ...(it.fromRequester && { offerType: 'TRADE' as const, priceCzk: null }),
        quantity: Math.min(it.quantity, ci.spareQty),
      },
    })
  }
  const wanted = await prisma.tradeRequestItem.findMany({ where: { requestId: req.id, fromRequester: false } })
  if (!wanted.length) return { error: 'Nabídky v košíku už neplatí.' }

  await prisma.tradeRequest.update({ where: { id: req.id }, data: { status: 'PENDING', sentAt: new Date() } })
  await notify(
    req.to.email,
    parentCc(req.to),
    `Nová poptávka od ${user.nickname}`,
    [
      `<strong>${esc(user.nickname)}</strong> má zájem o ${wanted.length === 1 ? 'tuto kartu' : `${wanted.length} karet`}:`,
      wanted.map((w) => `• ${esc(w.title)} — ${w.quantity}× ${OFFER[w.offerType ?? 'TRADE']}${w.priceCzk ? ` za ${w.priceCzk} Kč` : ''}`).join('<br>'),
      'Když poptávku přijmete, uvidíte navzájem e-mail a domluvíte se na předání. Web neřeší platby ani dopravu.',
    ],
    { label: 'Zobrazit poptávku', url: `${APP_URL}/poptavky/${req.id}` },
  )
  revalidatePath('/', 'layout')
  redirect(`/poptavky/${req.id}?odeslano=1`)
}

export async function respondRequest(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser()
  const accept = str(fd, 'decision') === 'accept'
  const req = await prisma.tradeRequest.findUnique({ where: { id: str(fd, 'requestId') }, include: { from: true } })
  if (!req || req.toId !== user.id || req.status !== 'PENDING') return { error: 'Poptávka nenalezena.' }
  if (accept && isLimited(user)) return { error: 'Nejdřív musí rodič potvrdit tvůj účet.' }

  await prisma.tradeRequest.update({
    where: { id: req.id },
    data: { status: accept ? 'ACCEPTED' : 'DECLINED', respondedAt: new Date() },
  })
  await notify(
    req.from.email,
    parentCc(req.from),
    accept ? `${user.nickname} přijal(a) tvoji poptávku` : `${user.nickname} poptávku odmítl(a)`,
    accept
      ? [
          `<strong>${esc(user.nickname)}</strong> přijal(a) poptávku. Kontakt pro domluvu: <strong>${esc(user.email)}</strong>${
            user.isMinor && user.parentEmail ? ` (rodič: ${esc(user.parentEmail)})` : ''
          }.`,
          'Domluvte se na předání nebo zaslání. Až bude hotovo, potvrďte to na webu a ohodnoťte se.',
        ]
      : ['Nevadí — zkus kartu najít u někoho jiného.'],
    { label: 'Zobrazit poptávku', url: `${APP_URL}/poptavky/${req.id}` },
  )
  if (accept)
    await notify(
      user.email,
      parentCc(user),
      `Kontakt na ${req.from.nickname}`,
      [
        `Přijal(a) jsi poptávku od <strong>${esc(req.from.nickname)}</strong>. Kontakt pro domluvu: <strong>${esc(req.from.email)}</strong>${
          req.from.isMinor && req.from.parentEmail ? ` (rodič: ${esc(req.from.parentEmail)})` : ''
        }.`,
      ],
      { label: 'Zobrazit poptávku', url: `${APP_URL}/poptavky/${req.id}` },
    )
  revalidatePath('/', 'layout')
  return { ok: accept ? 'Přijato. Kontakt najdeš níže a v e-mailu.' : 'Odmítnuto.' }
}

export async function cancelRequest(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser()
  const req = await prisma.tradeRequest.findUnique({ where: { id: str(fd, 'requestId') }, include: { from: true, to: true } })
  if (!req || (req.fromId !== user.id && req.toId !== user.id) || !['PENDING', 'ACCEPTED'].includes(req.status))
    return { error: 'Poptávku už nejde zrušit.' }
  await prisma.tradeRequest.update({ where: { id: req.id }, data: { status: 'CANCELLED' } })
  const other = req.fromId === user.id ? req.to : req.from
  await notify(other.email, parentCc(other), `${user.nickname} zrušil(a) poptávku`, ['Poptávka byla zrušena.'], {
    label: 'Zobrazit',
    url: `${APP_URL}/poptavky/${req.id}`,
  })
  revalidatePath('/', 'layout')
  return { ok: 'Zrušeno.' }
}

/** Obě strany potvrdí, že výměna proběhla. Pak se kusy odečtou ze sbírek. */
export async function markDone(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser()
  const req = await prisma.tradeRequest.findUnique({ where: { id: str(fd, 'requestId') }, include: { items: true } })
  if (!req || req.status !== 'ACCEPTED' || (req.fromId !== user.id && req.toId !== user.id))
    return { error: 'Poptávka nenalezena.' }
  const now = new Date()
  const fromDoneAt = req.fromId === user.id ? now : req.fromDoneAt
  const toDoneAt = req.toId === user.id ? now : req.toDoneAt
  const completed = !!(fromDoneAt && toDoneAt)

  await prisma.$transaction(async (tx) => {
    await tx.tradeRequest.update({
      where: { id: req.id },
      data: { fromDoneAt, toDoneAt, ...(completed && { status: 'COMPLETED' }) },
    })
    if (!completed) return
    for (const it of req.items) {
      if (!it.collectionItemId) continue
      const ci = await tx.collectionItem.findUnique({ where: { id: it.collectionItemId } })
      if (!ci) continue
      const quantity = Math.max(ci.quantity - it.quantity, 0)
      const spareQty = Math.max(ci.spareQty - it.quantity, 0)
      if (quantity === 0) await tx.collectionItem.delete({ where: { id: ci.id } })
      else
        await tx.collectionItem.update({
          where: { id: ci.id },
          data: { quantity, spareQty, ...(spareQty === 0 && { offerType: null, priceCzk: null }) },
        })
    }
  })
  revalidatePath(`/poptavky/${req.id}`)
  return {
    ok: completed
      ? 'Hotovo! Kusy jsme odečetli ze sbírek. Nezapomeň druhou stranu ohodnotit.'
      : 'Díky, čekáme ještě na potvrzení druhé strany.',
  }
}

export async function rateRequest(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser()
  const req = await prisma.tradeRequest.findUnique({ where: { id: str(fd, 'requestId') } })
  if (!req || req.status !== 'COMPLETED' || (req.fromId !== user.id && req.toId !== user.id))
    return { error: 'Hodnotit jde jen dokončenou výměnu.' }
  const tag = str(fd, 'tag') as RatingTag
  const positive = str(fd, 'positive') === '1'
  await prisma.rating.upsert({
    where: { requestId_fromId: { requestId: req.id, fromId: user.id } },
    create: {
      requestId: req.id,
      fromId: user.id,
      toId: req.fromId === user.id ? req.toId : req.fromId,
      positive,
      tag: TAGS.includes(tag) ? tag : null,
    },
    update: { positive, tag: TAGS.includes(tag) ? tag : null },
  })
  revalidatePath(`/poptavky/${req.id}`)
  return { ok: 'Díky za hodnocení.' }
}

export async function reportUser(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser()
  if (!rateLimit(`report:${await clientIp()}`, 5, 60 * 60_000)) return { error: 'Příliš mnoho hlášení, zkus to později.' }
  const against = await prisma.user.findUnique({ where: { id: str(fd, 'againstId') } })
  const reason = str(fd, 'reason')
  if (!against || against.id === user.id) return { error: 'Uživatel nenalezen.' }
  if (reason.length < 10 || reason.length > 500) return { error: 'Popiš prosím, co se stalo (10–500 znaků).' }
  await prisma.report.create({ data: { fromId: user.id, againstId: against.id, reason } })
  await notify(
    'info@jede.online',
    [],
    `Nahlášení uživatele ${against.nickname}`,
    [`Nahlásil(a): ${esc(user.nickname)} (${esc(user.email)})`, `Kdo: ${esc(against.nickname)} (${esc(against.email)})`, esc(reason)],
  )
  return { ok: 'Díky, nahlášení jsme dostali a podíváme se na to.' }
}
