import 'server-only'
import { prisma } from '@/lib/prisma'
import { APP_URL, esc, notify } from '@/lib/email'

const OFFER = { TRADE: 'vymění', SELL: 'prodá', GIFT: 'daruje' } as const
const MAX_LINES = 12

// Prodávající musí být viditelný: nezablokovaný a ne dítě bez souhlasu rodiče.
const visibleSeller = { bannedAt: null, OR: [{ isMinor: false }, { parentConsentAt: { not: null } }] }
const offered = { spareQty: { gt: 0 }, offerType: { not: null }, hiddenAt: null } as const

/**
 * Denní souhrn: „někdo nově nabízí kartu (produkt), která ti chybí“ a „někdo chce koupit, co nabízíš“.
 * Bere nabídky přidané/změněné od posledního souhrnu daného uživatele. Spouští cron (/api/cron/match-digest).
 */
export async function runMatchDigest() {
  const now = new Date()
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
  for (const u of users) {
    // První souhrn: posledních 24 hodin (ne celá historie).
    const since = u.matchDigestAt ?? new Date(now.getTime() - 24 * 3_600_000)
    const [cards, products] = await Promise.all([
      prisma.collectionItem.findMany({
        where: {
          ...offered,
          updatedAt: { gt: since, lte: now },
          userId: { not: u.id },
          user: visibleSeller,
          card: { wants: { some: { userId: u.id } } },
        },
        include: { card: { include: { set: { select: { name: true } } } }, user: { select: { nickname: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 50,
      }),
      prisma.productItem.findMany({
        where: {
          ...offered,
          updatedAt: { gt: since, lte: now },
          userId: { not: u.id },
          user: visibleSeller,
          product: { wants: { some: { userId: u.id } } },
        },
        include: { product: { select: { name: true } }, user: { select: { nickname: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 20,
      }),
    ])
    const lines = [
      ...cards.map(
        (i) =>
          `• <strong>${esc(i.card.name)}</strong> (${esc(i.card.set.name)} ${esc(i.card.localId)}) — ${esc(i.user.nickname)} ${OFFER[i.offerType!]}${i.offerType === 'SELL' && i.priceCzk ? ` za ${i.priceCzk} Kč` : ''}`,
      ),
      ...products.map(
        (i) =>
          `• <strong>${esc(i.product.name)}</strong> — ${esc(i.user.nickname)} ${OFFER[i.offerType!]}${i.offerType === 'SELL' && i.priceCzk ? ` za ${i.priceCzk} Kč` : ''}`,
      ),
    ]
    // Druhý směr: kdo nově chce koupit, co nabízím (poptávka „chci koupit“).
    const [buyCards, buyProducts] = await Promise.all([
      prisma.wantItem.findMany({
        where: {
          buy: true,
          updatedAt: { gt: since, lte: now },
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
          updatedAt: { gt: since, lte: now },
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
      const more = lines.length > MAX_LINES ? `<br>…a dalších ${lines.length - MAX_LINES}.` : ''
      await notify(
        u.email,
        // U dětí jde kopie rodiči, stejně jako u poptávek.
        u.isMinor && u.parentEmail ? [u.parentEmail] : [],
        lines.length
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
      sent++
    }
    await prisma.user.update({ where: { id: u.id }, data: { matchDigestAt: now } })
  }
  return { users: users.length, sent }
}
