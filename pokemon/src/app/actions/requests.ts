'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { CollectionItem, ProductItem, RatingTag, User } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, isLimited } from '@/lib/auth'
import { ADMIN_EMAIL, APP_URL, esc, notify } from '@/lib/email'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { pushNotification } from '@/lib/notifications'
import { str, type FormState } from '@/lib/validation'

const VARIANT = { NORMAL: 'Normální', HOLO: 'Holo', REVERSE: 'Reverse holo', FIRST_EDITION: '1st edition', POKEBALL: 'Poké Ball reverse', MASTERBALL: 'Master Ball reverse' } as const
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
    productId: null,
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
const productInclude = { product: { select: { id: true, name: true, imageUrl: true } } }
type FullProductItem = ProductItem & { product: { id: number; name: string; imageUrl: string | null } }

function snapshotProduct(i: FullProductItem) {
  return {
    cardId: null,
    productId: i.productId,
    title: i.product.name,
    detail: ['zapečetěno', i.language.toUpperCase(), i.note && `„${i.note}“`].filter(Boolean).join(' · '),
    imageUrl: i.product.imageUrl,
    offerType: i.offerType,
    priceCzk: i.offerType === 'SELL' ? i.priceCzk : null,
  }
}

// ── Košík ──────────────────────────────────────────────────────────

/** Rozpracovaná poptávka u prodávajícího; při souběžném vytvoření (dvojklik, dvě záložky) vezme tu existující. */
async function draftFor(fromId: string, toId: string) {
  const found = await prisma.tradeRequest.findFirst({ where: { fromId, toId, status: 'DRAFT' } })
  if (found) return found
  try {
    return await prisma.tradeRequest.create({ data: { fromId, toId } })
  } catch {
    // Unikátní index (fromId, toId) pro DRAFT — druhý požadavek byl rychlejší.
    return prisma.tradeRequest.findFirstOrThrow({ where: { fromId, toId, status: 'DRAFT' } })
  }
}

/** "Chci" u nabídky: přidá kus do košíku (rozpracované poptávky) u daného prodávajícího. */
export async function addToCart(_: FormState, fd: FormData): Promise<FormState> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Nejdřív se přihlas.' }
  if (str(fd, 'productItemId')) return addProductToCart(user, str(fd, 'productItemId'))
  const item = await prisma.collectionItem.findUnique({
    where: { id: str(fd, 'collectionItemId') },
    include: { ...itemInclude, user: true },
  })
  if (!item || item.spareQty < 1 || !item.offerType || item.hiddenAt || !visible(item.user))
    return { error: 'Nabídka už neplatí.' }
  if (item.userId === user.id) return { error: 'Tohle je tvoje vlastní nabídka.' }

  const draft = await draftFor(user.id, item.userId)
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

async function addProductToCart(user: User, productItemId: string): Promise<FormState> {
  const item = await prisma.productItem.findUnique({ where: { id: productItemId }, include: { ...productInclude, user: true } })
  if (!item || item.spareQty < 1 || !item.offerType || item.hiddenAt || !visible(item.user))
    return { error: 'Nabídka už neplatí.' }
  if (item.userId === user.id) return { error: 'Tohle je tvoje vlastní nabídka.' }
  const draft = await draftFor(user.id, item.userId)
  const existing = await prisma.tradeRequestItem.findFirst({
    where: { requestId: draft.id, productItemId: item.id, fromRequester: false },
  })
  if (existing) {
    if (existing.quantity >= item.spareQty) return { ok: 'Už máš v košíku všechny nabízené kusy.' }
    await prisma.tradeRequestItem.update({ where: { id: existing.id }, data: { quantity: existing.quantity + 1 } })
  } else {
    await prisma.tradeRequestItem.create({
      data: { requestId: draft.id, productItemId: item.id, fromRequester: false, ...snapshotProduct(item) },
    })
  }
  revalidatePath('/', 'layout')
  return { ok: 'Přidáno do košíku.' }
}

export async function setCartQty(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser()
  const row = await prisma.tradeRequestItem.findUnique({
    where: { id: str(fd, 'itemId') },
    include: { request: true, collectionItem: true, productItem: true },
  })
  if (!row || row.request.fromId !== user.id || row.request.status !== 'DRAFT') return { error: 'Položka nenalezena.' }
  const qty = Number(str(fd, 'quantity'))
  if (!Number.isInteger(qty) || qty > 999) return { error: 'Neplatný počet kusů.' }
  if (qty <= 0) {
    await prisma.tradeRequestItem.delete({ where: { id: row.id } })
    // Prázdný košík u prodávajícího zmizí.
    if (!(await prisma.tradeRequestItem.count({ where: { requestId: row.requestId, fromRequester: false } })))
      await prisma.tradeRequest.delete({ where: { id: row.requestId } })
  } else {
    const max = row.collectionItem?.spareQty ?? row.productItem?.spareQty ?? 0
    await prisma.tradeRequestItem.update({ where: { id: row.id }, data: { quantity: Math.min(qty, Math.max(max, 1)) } })
  }
  revalidatePath('/', 'layout')
  return undefined
}

/** Kupující nabídne na výměnu svůj kus navíc (jen kusy navíc ze své sbírky). */
export async function offerMyItem(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser()
  const req = await prisma.tradeRequest.findUnique({ where: { id: str(fd, 'requestId') } })
  if (!req || req.fromId !== user.id || req.status !== 'DRAFT') return { error: 'Výměna nenalezena.' }
  // Hodnota "c:<id>" = karta, "p:<id>" = produkt.
  const [kind, id] = str(fd, 'mine').split(':')
  if (kind === 'p') {
    const mine = await prisma.productItem.findUnique({ where: { id }, include: productInclude })
    if (!mine || mine.userId !== user.id || mine.spareQty < 1) return { error: 'Vyber svůj kus navíc.' }
    if (await prisma.tradeRequestItem.findFirst({ where: { requestId: req.id, productItemId: mine.id, fromRequester: true } }))
      return { ok: 'Už je nabídnutý.' }
    await prisma.tradeRequestItem.create({
      data: { requestId: req.id, productItemId: mine.id, fromRequester: true, ...snapshotProduct(mine), offerType: 'TRADE', priceCzk: null },
    })
  } else {
    const mine = await prisma.collectionItem.findUnique({ where: { id }, include: itemInclude })
    if (!mine || mine.userId !== user.id || mine.spareQty < 1) return { error: 'Vyber svůj kus navíc.' }
    if (await prisma.tradeRequestItem.findFirst({ where: { requestId: req.id, collectionItemId: mine.id, fromRequester: true } }))
      return { ok: 'Už je nabídnutý.' }
    await prisma.tradeRequestItem.create({
      data: { requestId: req.id, collectionItemId: mine.id, fromRequester: true, ...snapshot(mine), offerType: 'TRADE', priceCzk: null },
    })
  }
  revalidatePath('/kosik')
  return undefined
}

// ── Odeslání a odpověď ─────────────────────────────────────────────

export async function sendRequest(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser()
  if (isLimited(user)) return { error: 'Žádosti o výměnu půjde posílat, až rodič potvrdí tvůj účet.' }
  if (!user.emailVerifiedAt) return { error: 'Nejdřív potvrď svůj e-mail (odkaz najdeš na stránce Můj účet).' }
  if (!rateLimit(`request:${user.id}`, 20, 24 * 60 * 60_000)) return { error: 'Dnes už jsi poslal(a) hodně žádostí.' }

  const req = await prisma.tradeRequest.findUnique({
    where: { id: str(fd, 'requestId') },
    include: {
      to: true,
      items: { include: { collectionItem: { include: itemInclude }, productItem: { include: productInclude } } },
    },
  })
  if (!req || req.fromId !== user.id || req.status !== 'DRAFT') return { error: 'Výměna nenalezena.' }
  if (!visible(req.to)) return { error: 'Tento uživatel teď žádosti nepřijímá.' }

  // Aktualizovat snapshot podle současného stavu nabídek; zmizelé položky vyřadit.
  for (const it of req.items) {
    const ci = it.collectionItem ?? it.productItem
    if (!ci || ci.spareQty < 1 || (!it.fromRequester && (!ci.offerType || ci.hiddenAt))) {
      await prisma.tradeRequestItem.delete({ where: { id: it.id } })
      continue
    }
    await prisma.tradeRequestItem.update({
      where: { id: it.id },
      data: {
        ...(it.collectionItem ? snapshot(it.collectionItem) : snapshotProduct(it.productItem!)),
        ...(it.fromRequester && { offerType: 'TRADE' as const, priceCzk: null }),
        quantity: Math.min(it.quantity, ci.spareQty),
      },
    })
  }
  const wanted = await prisma.tradeRequestItem.findMany({ where: { requestId: req.id, fromRequester: false } })
  if (!wanted.length) return { error: 'Nabídky v košíku už neplatí.' }

  // Podmíněně: dvojí odeslání nesmí poslat dva e-maily.
  const sent = await prisma.tradeRequest.updateMany({
    where: { id: req.id, status: 'DRAFT' },
    data: { status: 'PENDING', sentAt: new Date() },
  })
  if (!sent.count) redirect(`/poptavky/${req.id}`)
  await pushNotification(req.toId, {
    icon: '📩',
    title: `Nová žádost o výměnu od ${user.nickname}`,
    body: wanted.map((w) => w.title).slice(0, 3).join(', ') + (wanted.length > 3 ? '…' : ''),
    url: `/poptavky/${req.id}`,
  })
  await notify(
    req.to.email,
    parentCc(req.to),
    `Nová žádost o výměnu od ${user.nickname}`,
    [
      `<strong>${esc(user.nickname)}</strong> má zájem o ${wanted.length === 1 ? 'tuto kartu' : `${wanted.length} karet`}:`,
      wanted.map((w) => `• ${esc(w.title)} — ${w.quantity}× ${OFFER[w.offerType ?? 'TRADE']}${w.priceCzk ? ` za ${w.priceCzk} Kč` : ''}`).join('<br>'),
      'Když žádost přijmete, uvidíte navzájem e-mail a domluvíte se na předání. Web neřeší platby ani dopravu.',
    ],
    { label: 'Zobrazit výměnu', url: `${APP_URL}/poptavky/${req.id}` },
  )
  revalidatePath('/', 'layout')
  redirect(`/poptavky/${req.id}?odeslano=1`)
}

export async function respondRequest(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser()
  const accept = str(fd, 'decision') === 'accept'
  const req = await prisma.tradeRequest.findUnique({ where: { id: str(fd, 'requestId') }, include: { from: true } })
  if (!req || req.toId !== user.id || req.status !== 'PENDING') return { error: 'Výměna nenalezena.' }
  if (accept && isLimited(user)) return { error: 'Nejdřív musí rodič potvrdit tvůj účet.' }
  // Kontakt (u dětí i rodiče) nesmí dostat zablokovaný nebo omezený žadatel.
  if (accept && (!visible(req.from) || !req.from.emailVerifiedAt)) {
    await prisma.tradeRequest.updateMany({ where: { id: req.id, status: 'PENDING' }, data: { status: 'CANCELLED' } })
    return { error: 'Tento uživatel už žádosti posílat nemůže. Žádost jsme zrušili.' }
  }

  const res = await prisma.tradeRequest.updateMany({
    where: { id: req.id, status: 'PENDING' },
    data: { status: accept ? 'ACCEPTED' : 'DECLINED', respondedAt: new Date() },
  })
  if (!res.count) return { error: 'Žádost se mezitím změnila. Obnov stránku.' }
  await pushNotification(req.fromId, {
    icon: accept ? '✅' : '❌',
    title: accept ? `${user.nickname} přijal(a) tvoji žádost` : `${user.nickname} žádost odmítl(a)`,
    body: accept ? 'Kontakt pro domluvu najdeš v detailu výměny.' : undefined,
    url: `/poptavky/${req.id}`,
  })
  await notify(
    req.from.email,
    parentCc(req.from),
    accept ? `${user.nickname} přijal(a) tvoji žádost` : `${user.nickname} žádost odmítl(a)`,
    accept
      ? [
          `<strong>${esc(user.nickname)}</strong> přijal(a) žádost. Kontakt pro domluvu: <strong>${esc(user.email)}</strong>${
            user.isMinor && user.parentEmail ? ` (rodič: ${esc(user.parentEmail)})` : ''
          }.`,
          'Domluvte se na předání nebo zaslání. Až bude hotovo, potvrďte to na webu a ohodnoťte se.',
        ]
      : ['Nevadí — zkus kartu najít u někoho jiného.'],
    { label: 'Zobrazit výměnu', url: `${APP_URL}/poptavky/${req.id}` },
  )
  if (accept)
    await notify(
      user.email,
      parentCc(user),
      `Kontakt na ${req.from.nickname}`,
      [
        `Přijal(a) jsi žádost od <strong>${esc(req.from.nickname)}</strong>. Kontakt pro domluvu: <strong>${esc(req.from.email)}</strong>${
          req.from.isMinor && req.from.parentEmail ? ` (rodič: ${esc(req.from.parentEmail)})` : ''
        }.`,
      ],
      { label: 'Zobrazit výměnu', url: `${APP_URL}/poptavky/${req.id}` },
    )
  revalidatePath('/', 'layout')
  return { ok: accept ? 'Přijato. Kontakt najdeš níže a v e-mailu.' : 'Odmítnuto.' }
}

export async function cancelRequest(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser()
  const req = await prisma.tradeRequest.findUnique({ where: { id: str(fd, 'requestId') }, include: { from: true, to: true } })
  if (!req || (req.fromId !== user.id && req.toId !== user.id) || !['PENDING', 'ACCEPTED'].includes(req.status))
    return { error: 'Výměnu už nejde zrušit.' }
  const res = await prisma.tradeRequest.updateMany({
    where: { id: req.id, status: { in: ['PENDING', 'ACCEPTED'] } },
    data: { status: 'CANCELLED' },
  })
  if (!res.count) return { error: 'Výměnu už nejde zrušit.' }
  const other = req.fromId === user.id ? req.to : req.from
  await pushNotification(other.id, { icon: '🚫', title: `${user.nickname} zrušil(a) výměnu`, url: `/poptavky/${req.id}` })
  await notify(other.email, parentCc(other), `${user.nickname} zrušil(a) výměnu`, ['Výměna byla zrušena.'], {
    label: 'Zobrazit',
    url: `${APP_URL}/poptavky/${req.id}`,
  })
  revalidatePath('/', 'layout')
  return { ok: 'Zrušeno.' }
}

/** Obě strany potvrdí, že výměna proběhla. Pak se kusy odečtou ze sbírek (právě jednou). */
export async function markDone(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser()
  const req = await prisma.tradeRequest.findUnique({ where: { id: str(fd, 'requestId') } })
  if (!req || req.status !== 'ACCEPTED' || (req.fromId !== user.id && req.toId !== user.id))
    return { error: 'Výměna nenalezena.' }
  const mine = req.fromId === user.id ? { fromDoneAt: new Date() } : { toDoneAt: new Date() }

  const completed = await prisma.$transaction(async (tx) => {
    // Nastavit jen svoje potvrzení (nepřepsat to druhé strany).
    const own = await tx.tradeRequest.updateMany({ where: { id: req.id, status: 'ACCEPTED' }, data: mine })
    if (!own.count) return false
    // Dokončit smí jen jeden požadavek — ten, kterému podmíněný update projde.
    const done = await tx.tradeRequest.updateMany({
      where: { id: req.id, status: 'ACCEPTED', fromDoneAt: { not: null }, toDoneAt: { not: null } },
      data: { status: 'COMPLETED' },
    })
    if (!done.count) return false
    const items = await tx.tradeRequestItem.findMany({ where: { requestId: req.id } })
    for (const it of items) {
      if (it.productItemId) {
        const pi = await tx.productItem.findUnique({ where: { id: it.productItemId } })
        if (pi) {
          const quantity = Math.max(pi.quantity - it.quantity, 0)
          const spareQty = Math.min(Math.max(pi.spareQty - it.quantity, 0), quantity)
          if (quantity === 0) await tx.productItem.delete({ where: { id: pi.id } })
          else
            await tx.productItem.update({
              where: { id: pi.id },
              data: { quantity, spareQty, ...(spareQty === 0 && { offerType: null, priceCzk: null }) },
            })
        }
      } else if (it.collectionItemId) {
        const ci = await tx.collectionItem.findUnique({ where: { id: it.collectionItemId } })
        if (ci) {
          const quantity = Math.max(ci.quantity - it.quantity, 0)
          const spareQty = Math.min(Math.max(ci.spareQty - it.quantity, 0), quantity)
          if (quantity === 0) await tx.collectionItem.delete({ where: { id: ci.id } })
          else
            await tx.collectionItem.update({
              where: { id: ci.id },
              data: { quantity, spareQty, ...(spareQty === 0 && { offerType: null, priceCzk: null }) },
            })
        }
      }
      // Co jsem dostal(a), už mi nechybí: kupující dostal položky prodávajícího a naopak.
      const receiver = it.fromRequester ? req.toId : req.fromId
      if (it.cardId) await tx.wantItem.deleteMany({ where: { userId: receiver, cardId: it.cardId } })
      if (it.productId) await tx.productWant.deleteMany({ where: { userId: receiver, productId: it.productId } })
    }
    return true
  })
  revalidatePath(`/poptavky/${req.id}`)
  const fresh = await prisma.tradeRequest.findUnique({ where: { id: req.id }, select: { status: true } })
  const otherId = req.fromId === user.id ? req.toId : req.fromId
  if (completed)
    for (const uid of [req.fromId, req.toId])
      await pushNotification(uid, {
        icon: '🎉',
        title: 'Výměna je dokončená',
        body: 'Nezapomeň druhou stranu ohodnotit.',
        url: `/poptavky/${req.id}`,
      })
  else if (fresh?.status === 'ACCEPTED')
    await pushNotification(otherId, {
      icon: '📦',
      title: `${user.nickname} potvrdil(a), že výměna proběhla`,
      body: 'Potvrď to prosím taky, ať se kusy odečtou ze sbírek.',
      url: `/poptavky/${req.id}`,
    })
  return {
    ok:
      completed || fresh?.status === 'COMPLETED'
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
  const toId = req.fromId === user.id ? req.toId : req.fromId
  // Hodnocení z výměny nahrazuje volné hodnocení téhož člověka (nepočítat dvakrát).
  await prisma.rating.deleteMany({ where: { fromId: user.id, toId, requestId: null } })
  await prisma.rating.upsert({
    where: { requestId_fromId: { requestId: req.id, fromId: user.id } },
    create: {
      requestId: req.id,
      fromId: user.id,
      toId,
      positive,
      tag: TAGS.includes(tag) ? tag : null,
    },
    update: { positive, tag: TAGS.includes(tag) ? tag : null },
  })
  await pushNotification(toId, {
    icon: positive ? '👍' : '👎',
    title: `${user.nickname} tě ohodnotil(a) po výměně`,
    url: `/poptavky/${req.id}`,
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
    ADMIN_EMAIL,
    [],
    `Nahlášení uživatele ${against.nickname}`,
    [`Nahlásil(a): ${esc(user.nickname)} (${esc(user.email)})`, `Kdo: ${esc(against.nickname)} (${esc(against.email)})`, esc(reason)],
  )
  return { ok: 'Díky, nahlášení jsme dostali a podíváme se na to.' }
}
