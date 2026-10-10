import 'server-only'
import { prisma } from '@/lib/prisma'
import { pushNotification } from '@/lib/notifications'
import { tFor } from '@/lib/i18n/server'

const OFFER = { TRADE: 'vyměním', SELL: 'prodám', GIFT: 'daruji za poštovné' } as const

/**
 * Hlídání ceny: hned po zveřejnění (nebo změně) nabídky upozorní do zvonečku ty, kdo kartu chtějí koupit
 * („koupím do X Kč“) a nabídka je pod jejich cenou — nebo je to dar / výměna.
 */
export async function notifyDeals(itemIds: string[]) {
  if (!itemIds.length) return
  try {
    const items = await prisma.collectionItem.findMany({
      where: {
        id: { in: itemIds },
        spareQty: { gt: 0 },
        offerType: { not: null },
        hiddenAt: null,
        user: { bannedAt: null, OR: [{ isMinor: false }, { parentConsentAt: { not: null } }] },
      },
      include: { card: { include: { set: { select: { code: true } } } }, user: { select: { id: true, nickname: true } } },
    })
    for (const i of items) {
      const buyers = await prisma.wantItem.findMany({
        where: { cardId: i.cardId, buy: true, userId: { not: i.userId }, user: { bannedAt: null } },
        select: { userId: true, maxPriceCzk: true, user: { select: { locale: true } } },
        distinct: ['userId'],
      })
      for (const b of buyers) {
        const ok = i.offerType !== 'SELL' || (i.priceCzk != null && (b.maxPriceCzk == null || i.priceCzk <= b.maxPriceCzk))
        if (!ok) continue
        const tt = tFor(b.user.locale)
        const card = `${i.card.name} (${i.card.set.code ? `${i.card.set.code} ` : ''}${i.card.localId})`
        await pushNotification(b.userId, {
          icon: '💰',
          title:
            i.offerType === 'SELL'
              ? tt('{name} prodává {card} za {price} Kč', { name: i.user.nickname, card, price: i.priceCzk! })
              : tt('{name} nabízí {card}: {type}', { name: i.user.nickname, card, type: tt(OFFER[i.offerType!]) }),
          body: b.maxPriceCzk != null ? tt('Hlídáš ji do {max} Kč.', { max: b.maxPriceCzk }) : tt('Máš ji v seznamu „chci koupit“.'),
          url: `/karta/${encodeURIComponent(i.cardId)}`,
        })
      }
    }
  } catch (err) {
    console.error('[hlidani-ceny]', err)
  }
}
