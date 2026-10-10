'use server'

import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { isQuietNow, quietApplies, sendPush } from '@/lib/push'
import { getT } from '@/lib/i18n/server'

type SubJSON = { endpoint?: string; keys?: { p256dh?: string; auth?: string } }

/** Uloží odběr tohoto zařízení (stejné zařízení = stejný endpoint, jen se přepíše na aktuálního uživatele). */
export async function savePushSubscription(sub: SubJSON) {
  const user = await getCurrentUser()
  if (!user) return { ok: false }
  const endpoint = sub?.endpoint ?? ''
  const p256dh = sub?.keys?.p256dh ?? ''
  const auth = sub?.keys?.auth ?? ''
  if (!/^https:\/\/[^\s]{10,900}$/.test(endpoint) || !p256dh || p256dh.length > 200 || !auth || auth.length > 100) return { ok: false }
  if (!rateLimit(`push-sub:${user.id}`, 30, 3_600_000)) return { ok: false }
  // Max. 10 zařízení na účet — nejstarší odběry pryč.
  const old = await prisma.pushSubscription.findMany({ where: { userId: user.id, endpoint: { not: endpoint } }, orderBy: { createdAt: 'desc' }, skip: 9, select: { id: true } })
  if (old.length) await prisma.pushSubscription.deleteMany({ where: { id: { in: old.map((o) => o.id) } } })
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { endpoint, p256dh, auth, userId: user.id },
    update: { p256dh, auth, userId: user.id },
  })
  return { ok: true }
}

export async function removePushSubscription(endpoint: string) {
  const user = await getCurrentUser()
  if (!user || typeof endpoint !== 'string') return { ok: false }
  await prisma.pushSubscription.deleteMany({ where: { userId: user.id, endpoint } })
  return { ok: true }
}

/** Noční klid 21–8: vypnout si ho může jen dospělý (účet bez souhlasu rodiče). */
export async function setNightQuiet(quiet: boolean) {
  const user = await getCurrentUser()
  if (!user || user.isMinor) return { ok: false }
  await prisma.user.update({ where: { id: user.id }, data: { pushNightOk: !quiet } })
  return { ok: true }
}

/** Zkušební notifikace z Můj účet. */
export async function sendTestPush() {
  const t = await getT()
  const user = await getCurrentUser()
  if (!user) return { error: t('Přihlas se.') }
  if (!rateLimit(`push-test:${user.id}`, 5, 3_600_000)) return { error: t('Zkus to zase za chvíli.') }
  if (isQuietNow() && quietApplies(user)) return { error: t('Teď je noční klid (21:00–8:00), telefon nepípne. Upozornění najdeš pod zvonečkem.') }
  const r = await sendPush(user.id, { icon: '🔔', title: t('Notifikace fungují!'), body: t('Takhle ti dáme vědět o výměnách, zprávách a nabídkách.'), url: '/upozorneni' })
  return r.sent ? { ok: t('Odesláno, za pár vteřin by měl telefon pípnout.') } : { error: t('Na tomhle účtu zatím není žádné zařízení s povolenými notifikacemi.') }
}
