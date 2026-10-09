import 'server-only'
import { cache } from 'react'
import { prisma } from '@/lib/prisma'
import { setProgress } from '@/lib/progress'
import { pushNotification } from '@/lib/notifications'
import { countInviteIfQualified } from '@/lib/social'
import { tFor } from '@/lib/i18n/server'
import { BADGES, BADGE_BY_ID, LEVEL_NAME, PIONEER_UNTIL, badgeScore, levelFor, type BadgeId } from '@/lib/badges-def'

/** Aktuální hodnoty, ze kterých se počítají úrovně odznaků. */
export async function badgeValues(userId: string): Promise<Record<BadgeId, number>> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { emailVerifiedAt: true, isMinor: true, parentConsentAt: true, createdAt: true, invitedById: true },
  })
  const owned = { userId, quantity: { gt: 0 } }
  const [ratings, trades, cards, jaCards, sets, invites] = await Promise.all([
    // Jen ověřená hodnocení z výměn přes web.
    prisma.rating.groupBy({
      by: ['positive'],
      where: { toId: userId, requestId: { not: null }, hiddenAt: null, from: { bannedAt: null } },
      _count: true,
    }),
    prisma.tradeRequest.count({ where: { status: 'COMPLETED', OR: [{ fromId: userId }, { toId: userId }] } }),
    prisma.collectionItem.groupBy({ by: ['cardId'], where: owned }),
    prisma.collectionItem.groupBy({ by: ['cardId'], where: { ...owned, card: { set: { language: 'ja' } } } }),
    prisma.card.findMany({ where: { items: { some: owned } }, select: { setId: true }, distinct: ['setId'] }),
    prisma.user.count({ where: { invitedById: userId, inviteCountedAt: { not: null }, bannedAt: null } }),
  ])
  const pos = ratings.find((r) => r.positive)?._count ?? 0
  const neg = ratings.find((r) => !r.positive)?._count ?? 0
  const progress = await setProgress(
    userId,
    sets.map((s) => s.setId),
  )
  let complete = 0
  let master = 0
  for (const p of progress.values()) {
    if (p.base && p.base.total > 0 && p.base.owned === p.base.total) complete++
    if (p.master.total > 0 && p.master.owned === p.master.total) master++
  }
  return {
    reliable: pos + neg > 0 && pos / (pos + neg) >= 0.9 ? pos - neg : 0,
    trader: trades,
    ambassador: invites,
    invited: user.invitedById ? 1 : 0,
    master,
    complete,
    collector: cards.length,
    japanese: jaCards.length,
    pioneer: user.createdAt < PIONEER_UNTIL ? 1 : 0,
    verified: user.emailVerifiedAt && (!user.isMinor || user.parentConsentAt) ? 1 : 0,
  }
}

/**
 * Přepočítá odznaky uživatele, uloží je a za nově získané úrovně pošle upozornění do zvonečku.
 * Získané odznaky zůstávají navždy, jen „Spolehlivý“ sleduje aktuální hodnocení.
 */
export async function refreshBadges(userId: string) {
  const [values, rows, user] = await Promise.all([
    badgeValues(userId),
    prisma.userBadge.findMany({ where: { userId } }),
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { locale: true, topBadge: true, nickname: true } }),
  ])
  const have = new Map(rows.map((r) => [r.badge, r]))
  const gained: { id: BadgeId; level: number }[] = []
  const current = new Map<BadgeId, number>()

  for (const def of BADGES) {
    const computed = levelFor(def, values[def.id])
    const row = have.get(def.id)
    const dynamic = def.id === 'reliable'
    const level = dynamic ? computed : Math.max(computed, row?.level ?? 0)
    const maxLevel = Math.max(level, row?.maxLevel ?? 0)
    if (level > 0) current.set(def.id, level)
    if (level > (row?.maxLevel ?? 0)) gained.push({ id: def.id, level })
    if (!row && level === 0) continue
    if (row && row.level === level && row.maxLevel === maxLevel) continue
    await prisma.userBadge.upsert({
      where: { userId_badge: { userId, badge: def.id } },
      create: { userId, badge: def.id, level, maxLevel },
      update: { level, maxLevel, ...(row && level > row.level ? { earnedAt: new Date() } : {}) },
    })
  }

  let top: string | null = null
  let best = -Infinity
  for (const [id, level] of current) {
    const s = badgeScore(id, level)
    if (s > best) {
      best = s
      top = `${id}:${level}`
    }
  }
  if (top !== user.topBadge) await prisma.user.update({ where: { id: userId }, data: { topBadge: top } })

  if (gained.length) {
    const tt = tFor(user.locale)
    const label = (g: { id: BadgeId; level: number }) => {
      const def = BADGE_BY_ID.get(g.id)!
      return def.tiers ? `${def.icon} ${tt(def.name)} – ${tt(LEVEL_NAME[g.level])}` : `${def.icon} ${tt(def.name)}`
    }
    await pushNotification(userId, {
      icon: '🏅',
      title: gained.length === 1 ? tt('Získal(a) jsi odznak {badge}!', { badge: label(gained[0]) }) : tt('Získal(a) jsi nové odznaky!'),
      body: gained.length > 1 ? gained.map(label).join(', ') : undefined,
      url: `/@${encodeURIComponent(user.nickname)}#odznaky`,
    })
  }
  // Pozvaný se stal sběratelem → započítat zvoucímu (a přepočítat mu Ambasadora).
  const inviter = await countInviteIfQualified(userId, values.collector)
  if (inviter) await refreshBadges(inviter).catch((err) => console.error('[odznaky]', err))
  return { values, levels: current }
}

// Při prohlížení vlastních stránek přepočítat nejvýš jednou za 5 minut.
const lastRun = new Map<string, number>()
export async function maybeRefreshBadges(userId: string) {
  const now = Date.now()
  if ((lastRun.get(userId) ?? 0) > now - 5 * 60_000) return
  lastRun.set(userId, now)
  await refreshBadges(userId).catch((err) => console.error('[odznaky]', err))
}

/** Po akci (výměna, hodnocení, ověření): přepočítat hned, chyba nesmí shodit akci. */
export async function refreshBadgesSafe(...userIds: string[]) {
  for (const id of userIds) {
    lastRun.set(id, Date.now())
    await refreshBadges(id).catch((err) => console.error('[odznaky]', err))
  }
}

/** Denní přepočet všech aktivních účtů (cron). */
export async function refreshAllBadges() {
  const users = await prisma.user.findMany({ where: { bannedAt: null }, select: { id: true } })
  let ok = 0
  for (const u of users) {
    try {
      await refreshBadges(u.id)
      ok++
    } catch (err) {
      console.error('[odznaky]', u.id, err)
    }
  }
  return { users: users.length, ok }
}

/**
 * Nejlepší odznak podle přezdívky pro ikonku v seznamech. Dotazy z jednoho vykreslení se sloučí do jednoho
 * (komponenty v seznamu se renderují souběžně, první požadavek počká na konec téhož kola).
 */
const topBadgeLoader = cache(() => {
  let pending: Map<string, ((v: string | null) => void)[]> | null = null
  return (nickname: string) =>
    new Promise<string | null>((resolve) => {
      if (!pending) {
        const batch = new Map<string, ((v: string | null) => void)[]>()
        pending = batch
        setTimeout(async () => {
          pending = null
          const rows = await prisma.user
            .findMany({ where: { nickname: { in: [...batch.keys()] } }, select: { nickname: true, topBadge: true } })
            .catch(() => [])
          const map = new Map(rows.map((r) => [r.nickname, r.topBadge]))
          for (const [nick, cbs] of batch) for (const cb of cbs) cb(map.get(nick) ?? null)
        }, 0)
      }
      const list = pending.get(nickname) ?? []
      list.push(resolve)
      pending.set(nickname, list)
    })
})
export const topBadgeOf = (nickname: string) => topBadgeLoader()(nickname)
