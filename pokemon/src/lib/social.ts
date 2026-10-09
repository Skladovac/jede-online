import 'server-only'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { pushNotification } from '@/lib/notifications'
import { tFor } from '@/lib/i18n/server'

/** Pozvánky a sledování sběratelů. */

export const INVITE_COOKIE = 'pozvanka'
export const INVITE_MIN_CARDS = 10

const visible = { bannedAt: null, OR: [{ isMinor: false }, { parentConsentAt: { not: null } }] }

/** Po registraci: kdo přišel přes pozvánkový odkaz, propojí se se zvoucím (vzájemné sledování). */
export async function applyInvite(newUserId: string) {
  const jar = await cookies()
  const nick = jar.get(INVITE_COOKIE)?.value
  if (!nick) return
  jar.delete(INVITE_COOKIE)
  const [inviter, me] = await Promise.all([
    prisma.user.findFirst({ where: { nickname: { equals: nick, mode: 'insensitive' }, bannedAt: null } }),
    prisma.user.findUnique({ where: { id: newUserId }, select: { nickname: true } }),
  ])
  if (!inviter || !me || inviter.id === newUserId) return
  await prisma.user.update({ where: { id: newUserId }, data: { invitedById: inviter.id } })
  await prisma.follow.createMany({
    data: [
      { followerId: newUserId, followingId: inviter.id },
      { followerId: inviter.id, followingId: newUserId },
    ],
    skipDuplicates: true,
  })
  const tt = tFor(inviter.locale)
  await pushNotification(inviter.id, {
    icon: '🎁',
    title: tt('{name} se zaregistroval(a) přes tvou pozvánku', { name: me.nickname }),
    body: tt('Započítá se ti, až si potvrdí e-mail a přidá aspoň {n} karet do sbírky.', { n: INVITE_MIN_CARDS }),
    url: `/@${encodeURIComponent(me.nickname)}`,
  })
}

/**
 * Započítání pozvánky (volá se při přepočtu odznaků pozvaného). Vrací id zvoucího, když se právě započítala.
 * Podmínky: potvrzený e-mail, u dítěte souhlas rodiče, aspoň 10 různých karet ve sbírce.
 */
export async function countInviteIfQualified(userId: string, distinctCards: number) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { nickname: true, invitedById: true, inviteCountedAt: true, emailVerifiedAt: true, isMinor: true, parentConsentAt: true },
  })
  if (!u?.invitedById || u.inviteCountedAt) return null
  if (!u.emailVerifiedAt || (u.isMinor && !u.parentConsentAt) || distinctCards < INVITE_MIN_CARDS) return null
  const done = await prisma.user.updateMany({ where: { id: userId, inviteCountedAt: null }, data: { inviteCountedAt: new Date() } })
  if (!done.count) return null
  const inviter = await prisma.user.findUnique({ where: { id: u.invitedById }, select: { locale: true } })
  if (inviter) {
    const tt = tFor(inviter.locale)
    await pushNotification(u.invitedById, {
      icon: '📣',
      title: tt('Pozvánka se započítala: {name} je teď plnohodnotný sběratel!', { name: u.nickname }),
      url: `/@${encodeURIComponent(u.nickname)}`,
    })
  }
  return u.invitedById
}

/** Koho uživatel sleduje (id). */
export async function followingIds(userId: string | null | undefined) {
  if (!userId) return new Set<string>()
  const rows = await prisma.follow.findMany({ where: { followerId: userId }, select: { followingId: true } })
  return new Set(rows.map((r) => r.followingId))
}

/** Přezdívky sledovaných přihlášeným uživatelem (štítek „Sleduješ“ na tržišti). */
export async function followingNicknames() {
  const user = await getCurrentUser()
  if (!user) return new Set<string>()
  const rows = await prisma.follow.findMany({ where: { followerId: user.id }, select: { following: { select: { nickname: true } } } })
  return new Set(rows.map((r) => r.following.nickname))
}

/**
 * Denní souhrn: „{přezdívka} přidal(a) N nových nabídek“ — jedno upozornění za každého sledovaného,
 * který od posledního souhrnu (nejdéle 24 h zpět) něco nabídl.
 */
export async function runFollowDigest() {
  const now = new Date()
  const dayAgo = new Date(now.getTime() - 24 * 3_600_000)
  const followers = await prisma.user.findMany({
    where: { bannedAt: null, following: { some: {} } },
    select: { id: true, locale: true, followDigestAt: true, following: { select: { followingId: true } } },
  })
  let sent = 0
  for (const f of followers) {
    const since = f.followDigestAt && f.followDigestAt > dayAgo ? f.followDigestAt : dayAgo
    const ids = f.following.map((x) => x.followingId)
    const where = { userId: { in: ids }, spareQty: { gt: 0 }, offerType: { not: null }, hiddenAt: null, offeredAt: { gt: since, lte: now }, user: visible }
    const [cards, products] = await Promise.all([
      prisma.collectionItem.groupBy({ by: ['userId'], where, _count: true }),
      prisma.productItem.groupBy({ by: ['userId'], where, _count: true }),
    ])
    const counts = new Map<string, number>()
    for (const r of [...cards, ...products]) counts.set(r.userId, (counts.get(r.userId) ?? 0) + r._count)
    if (counts.size) {
      const names = await prisma.user.findMany({ where: { id: { in: [...counts.keys()] } }, select: { id: true, nickname: true } })
      const tt = tFor(f.locale)
      for (const n of names) {
        const count = counts.get(n.id)!
        await pushNotification(f.id, {
          icon: '👀',
          title:
            count === 1
              ? tt('{name} přidal(a) novou nabídku', { name: n.nickname })
              : tt('{name} přidal(a) {count} nových nabídek', { name: n.nickname, count }),
          url: `/@${encodeURIComponent(n.nickname)}`,
        })
        sent++
      }
    }
    await prisma.user.update({ where: { id: f.id }, data: { followDigestAt: now } })
  }
  return { followers: followers.length, sent }
}
