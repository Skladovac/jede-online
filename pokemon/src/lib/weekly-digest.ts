import 'server-only'
import { prisma } from '@/lib/prisma'
import { APP_URL, esc, notify } from '@/lib/email'
import { tFor } from '@/lib/i18n/server'

const visible = { bannedAt: null, OR: [{ isMinor: false }, { parentConsentAt: { not: null } }] }
const offered = { spareQty: { gt: 0 }, offerType: { not: null }, hiddenAt: null } as const
const WEEK = 7 * 86_400_000

/** Hodina v Praze (server běží v UTC; letní/zimní čas řeší Intl). */
const pragueParts = (d = new Date()) => {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Prague', weekday: 'short', hour: '2-digit', hour12: false }).formatToParts(d)
  return { weekday: p.find((x) => x.type === 'weekday')?.value, hour: Number(p.find((x) => x.type === 'hour')?.value) }
}

let running = false

/**
 * Týdenní souhrn (neděle kolem 17:00 pražského času). Cron volá každou hodinu v neděli,
 * odešle se jen v 17 h a každému nejvýš jednou za týden. `force` = ruční spuštění mimo čas (test).
 */
export async function runWeeklyDigest({ force = false } = {}) {
  const { weekday, hour } = pragueParts()
  if (!force && (weekday !== 'Sun' || hour !== 17)) return { skipped: `ne teď (${weekday} ${hour} h)` }
  if (running) return { skipped: 'already-running' }
  running = true
  try {
    return await digest()
  } finally {
    running = false
  }
}

async function digest() {
  const now = new Date()
  const since = new Date(now.getTime() - WEEK)
  const users = await prisma.user.findMany({
    where: {
      weeklyEmails: true,
      emailVerifiedAt: { not: null },
      ...visible,
      OR: [{ weeklyDigestAt: null }, { weeklyDigestAt: { lt: new Date(now.getTime() - 6 * 86_400_000) } }],
    },
    select: { id: true, email: true, nickname: true, isMinor: true, parentEmail: true, locale: true },
  })
  let sent = 0
  let failed = 0
  for (const u of users) {
    try {
      const tt = tFor(u.locale)
      const [offers, buys, followers, ratings, myOffers, inCarts, requests] = await Promise.all([
        // Nové nabídky karet, které mi chybí.
        prisma.collectionItem.findMany({
          where: { ...offered, offeredAt: { gt: since }, userId: { not: u.id }, user: visible, card: { wants: { some: { userId: u.id } } } },
          include: { card: { include: { set: { select: { name: true } } } }, user: { select: { nickname: true } } },
          orderBy: { offeredAt: 'desc' },
          take: 30,
        }),
        prisma.wantItem.findMany({ where: { userId: u.id, buy: true }, select: { cardId: true, maxPriceCzk: true } }),
        prisma.follow.findMany({ where: { followingId: u.id, createdAt: { gt: since } }, select: { follower: { select: { nickname: true } } } }),
        prisma.rating.groupBy({ by: ['positive'], where: { toId: u.id, createdAt: { gt: since }, hiddenAt: null }, _count: true }),
        prisma.collectionItem.count({ where: { userId: u.id, ...offered } }),
        // U kolika lidí mám teď karty v košíku (rozpracované žádosti).
        prisma.tradeRequest.count({ where: { toId: u.id, status: 'DRAFT', items: { some: {} } } }),
        prisma.tradeRequest.count({ where: { toId: u.id, sentAt: { gt: since } } }),
      ])
      const max = new Map(buys.map((b) => [b.cardId, b.maxPriceCzk]))
      const isDeal = (o: (typeof offers)[number]) =>
        max.has(o.cardId) && (o.offerType !== 'SELL' || (o.priceCzk != null && (max.get(o.cardId) == null || o.priceCzk <= max.get(o.cardId)!)))
      const sorted = [...offers].sort((a, b) => Number(isDeal(b)) - Number(isDeal(a)))
      const pos = ratings.find((r) => r.positive)?._count ?? 0
      const neg = ratings.find((r) => !r.positive)?._count ?? 0

      const parts: string[] = []
      if (sorted.length) {
        parts.push(`<strong>${tt('Nové nabídky karet, které ti chybí ({n})', { n: offers.length })}</strong>`)
        for (const o of sorted.slice(0, 8)) {
          const price = o.offerType === 'SELL' ? (o.priceCzk ? tt('za {price} Kč', { price: o.priceCzk }) : '') : o.offerType === 'GIFT' ? tt('daruje') : tt('vymění')
          parts.push(`${isDeal(o) ? '✅' : '•'} ${esc(o.card.name)} (${esc(o.card.set.name)} ${esc(o.card.localId)}) — ${esc(o.user.nickname)} ${price}`)
        }
        if (sorted.length > 8) parts.push(tt('…a další na webu.'))
      }
      if (followers.length)
        parts.push(`👀 ${tt('Noví sledující: {names}', { names: followers.map((f) => esc(f.follower.nickname)).join(', ') })}`)
      if (pos + neg) parts.push(`⭐ ${tt('Nová hodnocení: 👍 {pos} · 👎 {neg}', { pos, neg })}`)
      if (requests || inCarts)
        parts.push(`🏷️ ${tt('Tvoje nabídky ({offers}): žádosti o výměnu za týden {requests}, v košíku je má teď {carts} lidí.', { offers: myOffers, requests, carts: inCarts })}`)

      if (!parts.length) {
        await prisma.user.update({ where: { id: u.id }, data: { weeklyDigestAt: now } })
        continue // nic nového — neposíláme prázdný e-mail
      }
      parts.push(`<span style="color:#667085;font-size:12px">${tt('Týdenní souhrn vypneš v Můj účet.')}</span>`)
      await notify(
        u.email,
        u.isMinor && u.parentEmail ? [u.parentEmail] : [],
        tt('Tvůj týden na pokemon.jede.online'),
        [tt('Ahoj {name}, tohle se za poslední týden stalo kolem tvé sbírky:', { name: esc(u.nickname) }), ...parts],
        { label: tt('Otevřít web'), url: APP_URL },
        u.locale,
      )
      await prisma.user.update({ where: { id: u.id }, data: { weeklyDigestAt: now } })
      sent++
    } catch (err) {
      failed++
      console.error('[tydenni-souhrn]', u.id, err)
    }
  }
  return { users: users.length, sent, failed }
}
