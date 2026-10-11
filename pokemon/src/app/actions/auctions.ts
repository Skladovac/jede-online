'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, isLimited } from '@/lib/auth'
import { ADMIN_EMAIL, APP_URL, esc, notify } from '@/lib/email'
import { pushNotification } from '@/lib/notifications'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { MAX_ACTIVE_AUCTIONS, MAX_AUCTION_ITEMS, normalizeAuctionUrl, parsePragueLocal } from '@/lib/auctions'
import { str, type FormState } from '@/lib/validation'
import { getT, tFor } from '@/lib/i18n/server'

/** Založení aukce: položky z katalogu (karty „c:id“, produkty „p:id“), odkaz na povolený web, konec v pražském čase. */
export async function createAuction(_: FormState, fd: FormData): Promise<FormState> {
  const t = await getT()
  const user = await getCurrentUser()
  if (!user) return { error: t('Přihlas se.') }
  if (!user.emailVerifiedAt) return { error: t('Aukci můžeš založit po potvrzení e-mailu.') }
  if (isLimited(user)) return { error: t('Aukce půjde zakládat, až rodič potvrdí tvůj účet.') }
  if (!rateLimit(`auction:${user.id}`, 10, 24 * 3_600_000)) return { error: t('Dnes už jsi založil(a) hodně aukcí. Zkus to zítra.') }

  const now = new Date()
  const active = await prisma.auction.count({ where: { userId: user.id, endsAt: { gt: now }, hiddenAt: null } })
  if (active >= MAX_ACTIVE_AUCTIONS) return { error: t('Najednou můžeš mít nejvýš {n} probíhajících aukcí.', { n: MAX_ACTIVE_AUCTIONS }) }

  const title = str(fd, 'title').replace(/\s+/g, ' ')
  if (title.length < 3 || title.length > 120) return { error: t('Název aukce musí mít 3–120 znaků.') }
  const url = normalizeAuctionUrl(str(fd, 'url'))
  if (!url) return { error: t('Odkaz musí vést na aukci na Facebooku, Aukru, Vintedu, Bazoši nebo eBayi.') }
  const endsAt = parsePragueLocal(str(fd, 'endsAt'))
  if (!endsAt || endsAt.getTime() < now.getTime() + 5 * 60_000) return { error: t('Konec aukce musí být v budoucnu (aspoň za 5 minut).') }
  if (endsAt.getTime() > now.getTime() + 60 * 86_400_000) return { error: t('Konec aukce může být nejpozději za 60 dní.') }
  const priceRaw = str(fd, 'startPrice').replace(/\s|Kč/gi, '')
  const startPriceCzk = priceRaw ? Number(priceRaw) : null
  if (startPriceCzk !== null && (!Number.isInteger(startPriceCzk) || startPriceCzk < 1 || startPriceCzk > 10_000_000))
    return { error: t('Vyvolávací cena musí být celé číslo v Kč.') }
  const note = str(fd, 'note').slice(0, 500) || null

  const raw = [...new Set(fd.getAll('item').map(String))].slice(0, MAX_AUCTION_ITEMS + 1)
  if (!raw.length) return { error: t('Přidej do aukce aspoň jednu kartu nebo produkt.') }
  if (raw.length > MAX_AUCTION_ITEMS) return { error: t('Do jedné aukce můžeš dát nejvýš {n} položek.', { n: MAX_AUCTION_ITEMS }) }
  const cardIds = raw.filter((r) => r.startsWith('c:')).map((r) => r.slice(2))
  const productIds = raw.filter((r) => /^p:\d{1,10}$/.test(r)).map((r) => Number(r.slice(2)))
  const [cards, products] = await Promise.all([
    prisma.card.findMany({ where: { id: { in: cardIds } }, select: { id: true, name: true } }),
    prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true } }),
  ])
  if (!cards.length && !products.length) return { error: t('Přidej do aukce aspoň jednu kartu nebo produkt.') }

  const auction = await prisma.auction.create({
    data: {
      userId: user.id,
      title,
      url,
      endsAt,
      startPriceCzk,
      note,
      items: { create: [...cards.map((c) => ({ cardId: c.id })), ...products.map((p) => ({ productId: p.id }))] },
    },
  })

  // Upozornění těm, kdo kartu / produkt hledají (chybějící, hlídání ceny). Každý jen jednou.
  const [wantCards, wantProducts] = await Promise.all([
    prisma.wantItem.findMany({ where: { cardId: { in: cards.map((c) => c.id) }, userId: { not: user.id } }, select: { userId: true, user: { select: { locale: true } } }, distinct: ['userId'], take: 300 }),
    prisma.productWant.findMany({ where: { productId: { in: products.map((p) => p.id) }, userId: { not: user.id } }, select: { userId: true, user: { select: { locale: true } } }, distinct: ['userId'], take: 300 }),
  ])
  const seen = new Set<string>()
  for (const w of [...wantCards, ...wantProducts]) {
    if (seen.has(w.userId)) continue
    seen.add(w.userId)
    const tt = tFor(w.user.locale)
    await pushNotification(w.userId, {
      icon: '🔨',
      title: tt('Nová aukce na kartu, kterou hledáš'),
      body: tt('{name}: {title}', { name: user.nickname, title }),
      url: `/aukce/${auction.id}`,
    })
  }

  revalidatePath('/aukce')
  redirect(`/aukce/${auction.id}`)
}

/** Smazání vlastní aukce (např. omyl v odkazu). */
export async function deleteAuction(fd: FormData) {
  const user = await getCurrentUser()
  if (!user) return
  const id = str(fd, 'id')
  await prisma.auction.deleteMany({ where: { id, userId: user.id } })
  revalidatePath('/aukce')
  redirect('/aukce')
}

/** Admin: skrýt / znovu zobrazit aukci (po nahlášení). */
export async function toggleAuctionHidden(fd: FormData) {
  const user = await getCurrentUser()
  if (!user?.isAdmin) return
  const id = str(fd, 'id')
  const a = await prisma.auction.findUnique({ where: { id }, select: { hiddenAt: true } })
  if (!a) return
  await prisma.auction.update({ where: { id }, data: { hiddenAt: a.hiddenAt ? null : new Date() } })
  revalidatePath(`/aukce/${id}`)
  revalidatePath('/aukce')
}

/** Nahlášení aukce (podvod, nevhodný obsah) — jde adminovi jako nahlášení prodejce. */
export async function reportAuction(_: FormState, fd: FormData): Promise<FormState> {
  const t = await getT()
  const user = await getCurrentUser()
  if (!user) return { error: t('Přihlas se.') }
  if (!rateLimit(`report:${await clientIp()}`, 5, 60 * 60_000)) return { error: t('Příliš mnoho hlášení, zkus to později.') }
  const auction = await prisma.auction.findUnique({ where: { id: str(fd, 'id') }, include: { user: { select: { id: true, nickname: true, email: true } } } })
  const reason = str(fd, 'reason')
  if (!auction || auction.userId === user.id) return { error: t('Aukce nenalezena.') }
  if (reason.length < 10 || reason.length > 400) return { error: t('Popiš prosím, co se stalo (10–400 znaků).') }
  await prisma.report.create({ data: { fromId: user.id, againstId: auction.userId, reason: `[aukce ${auction.id}] ${reason}`.slice(0, 500) } })
  await notify(ADMIN_EMAIL, [], `Nahlášení aukce: ${auction.title}`, [
    `Nahlásil(a): ${esc(user.nickname)} (${esc(user.email)})`,
    `Prodejce: ${esc(auction.user.nickname)} (${esc(auction.user.email)})`,
    `Aukce: <a href="${APP_URL}/aukce/${auction.id}">${esc(auction.title)}</a> · ${esc(auction.url)}`,
    esc(reason),
  ])
  return { ok: t('Díky, nahlášení jsme dostali a podíváme se na to.') }
}
