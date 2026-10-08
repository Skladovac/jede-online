import 'server-only'
import { prisma } from '@/lib/prisma'
import { APP_URL, esc, notify } from '@/lib/email'
import { pushNotification } from '@/lib/notifications'

const OFFER = { TRADE: 'vymění', SELL: 'prodá', GIFT: 'daruje' } as const
const MAX_LINES = 12

// Prodávající musí být viditelný: nezablokovaný a ne dítě bez souhlasu rodiče.
const visibleSeller = { bannedAt: null, OR: [{ isMinor: false }, { parentConsentAt: { not: null } }] }
const offered = { spareQty: { gt: 0 }, offerType: { not: null }, hiddenAt: null } as const

/**
 * Denní souhrn: „někdo nově nabízí kartu (produkt), která ti chybí“ a „někdo chce koupit, co nabízíš“.
 * Bere nabídky přidané/změněné od posledního souhrnu daného uživatele. Spouští cron (/api/cron/match-digest).
 */
let running = false

export async function runMatchDigest() {
  // Dva souběžné běhy (ruční + cron) by poslaly e-maily dvakrát.
  if (running) return { users: 0, sent: 0, skipped: 'already-running' }
  running = true
  try {
    return await digest()
  } finally {
    running = false
  }
}

async function digest() {
  const now = new Date()
  // Úklid: prošlá přihlášení a e-mailové odkazy.
  await prisma.session.deleteMany({ where: { expiresAt: { lt: now } } })
  await prisma.emailToken.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - 7 * 86_400_000) } } })
  // Anonymní otisky návštěvníků držíme jen 60 dní (denní součty zobrazení zůstávají).
  await prisma.notification.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 90 * 86_400_000) } } })
  await prisma.visitorDay.deleteMany({ where: { day: { lt: new Date(now.getTime() - 60 * 86_400_000) } } })
  const users = await prisma.user.findMany({
    where: {
      matchEmails: true,
      emailVerifiedAt: { not: null },
      bannedAt: null,
      OR: [{ isMinor: false }, { parentConsentAt: { not: null } }],
      // Kdo něco shání, nebo něco nabízí (pak ho zajímá, kdo to chce koupit).
      AND: [
        {
          OR: [
            { wants: { some: {} } },
            { productWants: { some: {} } },
            { items: { some: { spareQty: { gt: 0 }, offerType: { not: null } } } },
            { productItems: { some: { spareQty: { gt: 0 }, offerType: { not: null } } } },
          ],
        },
      ],
    },
    select: { id: true, email: true, nickname: true, isMinor: true, parentEmail: true, matchDigestAt: true },
  })
  let sent = 0
  let failed = 0
  for (const u of users) {
    try {
    // První souhrn: posledních 24 hodin (ne celá historie).
    const since = u.matchDigestAt ?? new Date(now.getTime() - 24 * 3_600_000)
    const [cards, products] = await Promise.all([
      prisma.collectionItem.findMany({
        where: {
          ...offered,
          offeredAt: { gt: since, lte: now },
          userId: { not: u.id },
          user: visibleSeller,
          card: { wants: { some: { userId: u.id } } },
        },
        include: { card: { include: { set: { select: { name: true } } } }, user: { select: { nickname: true } } },
        orderBy: { offeredAt: 'desc' },
        take: 50,
      }),
      prisma.productItem.findMany({
        where: {
          ...offered,
          offeredAt: { gt: since, lte: now },
          userId: { not: u.id },
          user: visibleSeller,
          product: { wants: { some: { userId: u.id } } },
        },
        include: { product: { select: { name: true } }, user: { select: { nickname: true } } },
        orderBy: { offeredAt: 'desc' },
        take: 20,
      }),
    ])
    // Hlídání ceny: moje „koupím do X Kč“ — nabídky pod touto cenou (nebo dar / výměna) dáme nahoru s ✅.
    const [myCardBuy, myProductBuy] = await Promise.all([
      prisma.wantItem.findMany({ where: { userId: u.id, buy: true }, select: { cardId: true, maxPriceCzk: true } }),
      prisma.productWant.findMany({ where: { userId: u.id, buy: true }, select: { productId: true, maxPriceCzk: true } }),
    ])
    const cardMax = new Map(myCardBuy.map((w) => [w.cardId, w.maxPriceCzk]))
    const productMax = new Map(myProductBuy.map((w) => [w.productId, w.maxPriceCzk]))
    const deal = (max: number | null | undefined, offerType: string | null, price: number | null) =>
      max != null && (offerType !== 'SELL' || (price != null && price <= max))
    const offerLine = (name: string, seller: string, offerType: string | null, price: number | null, max: number | null | undefined) =>
      `${deal(max, offerType, price) ? '✅' : '•'} ${name} — ${esc(seller)} ${OFFER[offerType as keyof typeof OFFER]}${
        offerType === 'SELL' && price ? ` za ${price} Kč` : ''
      }${deal(max, offerType, price) ? ` <strong>(tvoje cena: do ${max} Kč)</strong>` : ''}`
    const rows = [
      ...cards.map((i) => ({
        deal: deal(cardMax.get(i.cardId), i.offerType, i.priceCzk),
        line: offerLine(
          `<strong>${esc(i.card.name)}</strong> (${esc(i.card.set.name)} ${esc(i.card.localId)})`,
          i.user.nickname,
          i.offerType,
          i.priceCzk,
          cardMax.get(i.cardId),
        ),
      })),
      ...products.map((i) => ({
        deal: deal(productMax.get(i.productId), i.offerType, i.priceCzk),
        line: offerLine(`<strong>${esc(i.product.name)}</strong>`, i.user.nickname, i.offerType, i.priceCzk, productMax.get(i.productId)),
      })),
    ].sort((a, b) => Number(b.deal) - Number(a.deal))
    const lines = rows.map((r) => r.line)
    const deals = rows.filter((r) => r.deal).length
    // Druhý směr: kdo nově chce koupit, co nabízím (poptávka „chci koupit“).
    const [buyCards, buyProducts] = await Promise.all([
      prisma.wantItem.findMany({
        where: {
          buy: true,
          buyAt: { gt: since, lte: now },
          userId: { not: u.id },
          user: visibleSeller,
          card: { items: { some: { userId: u.id, ...offered } } },
        },
        include: { card: { include: { set: { select: { name: true } } } }, user: { select: { nickname: true } } },
        take: 30,
      }),
      prisma.productWant.findMany({
        where: {
          buy: true,
          buyAt: { gt: since, lte: now },
          userId: { not: u.id },
          user: visibleSeller,
          product: { items: { some: { userId: u.id, ...offered } } },
        },
        include: { product: { select: { name: true } }, user: { select: { nickname: true } } },
        take: 10,
      }),
    ])
    const buyLines = [
      ...buyCards.map(
        (w) =>
          `• <strong>${esc(w.card.name)}</strong> (${esc(w.card.set.name)} ${esc(w.card.localId)}) — ${esc(w.user.nickname)} koupí${w.maxPriceCzk ? ` za max. ${w.maxPriceCzk} Kč` : ''}`,
      ),
      ...buyProducts.map(
        (w) => `• <strong>${esc(w.product.name)}</strong> — ${esc(w.user.nickname)} koupí${w.maxPriceCzk ? ` za max. ${w.maxPriceCzk} Kč` : ''}`,
      ),
    ]

    if (lines.length || buyLines.length) {
      // Na webu (zvoneček) zvlášť nabídky a zájem o moje karty.
      if (lines.length)
        await pushNotification(u.id, {
          icon: deals ? '✅' : '🔔',
          title: deals ? `${deals}× nabídka za tvou cenu nebo levněji` : `Nové nabídky toho, co ti chybí (${lines.length})`,
          body: rows.map((r) => r.line.replace(/<[^>]+>/g, '').replace(/^[•✅]\s*/, '')).slice(0, 3).join(' · '),
          url: '/sberatele?kde=vse',
        })
      if (buyLines.length)
        await pushNotification(u.id, {
          icon: '💰',
          title: `Někdo chce koupit, co nabízíš (${buyLines.length})`,
          body: buyLines.map((l) => l.replace(/<[^>]+>/g, '').replace(/^•\s*/, '')).slice(0, 3).join(' · '),
          url: '/sbirka',
        })
      const more = lines.length > MAX_LINES ? `<br>…a dalších ${lines.length - MAX_LINES}.` : ''
      const ok = await notify(
        u.email,
        // U dětí jde kopie rodiči, stejně jako u poptávek.
        u.isMinor && u.parentEmail ? [u.parentEmail] : [],
        deals
          ? `✅ ${deals === 1 ? 'Nabídka' : `${deals} nabídky`} za tvou cenu nebo levněji`
          : lines.length
            ? lines.length === 1
              ? 'Někdo nabízí, co ti chybí'
              : `Nové nabídky toho, co ti chybí (${lines.length})`
            : 'Někdo chce koupit, co nabízíš',
        [
          `Ahoj <strong>${esc(u.nickname)}</strong>,`,
          ...(lines.length ? ['od posledního e-mailu se objevily nabídky toho, co sháníš:', lines.slice(0, MAX_LINES).join('<br>') + more] : []),
          ...(buyLines.length ? ['💰 <strong>Někdo chce koupit, co nabízíš:</strong>', buyLines.slice(0, MAX_LINES).join('<br>')] : []),
          `<small>Tyto e-maily můžeš vypnout v <a href="${APP_URL}/ucet">Můj účet</a>.</small>`,
        ],
        lines.length
          ? { label: 'Zobrazit, kdo to nabízí', url: `${APP_URL}/sberatele?kde=vse` }
          : { label: 'Otevřít moji sbírku', url: `${APP_URL}/sbirka` },
      )
      if (!ok) {
        // Nedoručeno (např. denní limit Brevo) — nechat na příště, nic se neztratí.
        failed++
        continue
      }
      sent++
    }
    await prisma.user.update({ where: { id: u.id }, data: { matchDigestAt: now } })
    } catch (err) {
      failed++
      console.error('[digest] uživatel', u.id, err)
    }
  }
  return { users: users.length, sent, failed }
}
