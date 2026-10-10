import 'server-only'
import webpush from 'web-push'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

/**
 * Push notifikace (Web Push, vlastní VAPID klíče — bez cizí služby).
 * Pípne všechno, co přijde pod zvoneček. Noční klid 21–8 (pražský čas): dospělý si ho může vypnout, dítě ne.
 */
const QUIET_FROM = 21
const QUIET_TO = 8

export const pushPublicKey = () => process.env.VAPID_PUBLIC_KEY || null

let ready: boolean | null = null
function setup() {
  if (ready !== null) return ready
  const pub = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  ready = !!(pub && priv)
  if (ready) webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'https://pokemon.jede.online', pub!, priv!)
  return ready
}

/** Je teď v Praze noční klid? */
export function isQuietNow(now = new Date()) {
  const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Prague', hour: '2-digit', hour12: false }).format(now)) % 24
  return h >= QUIET_FROM || h < QUIET_TO
}

/** Noční klid platí: dítě vždy, dospělý jen když si ho nevypnul. */
export const quietApplies = (u: { isMinor: boolean; pushNightOk: boolean }) => u.isMinor || !u.pushNightOk

type PushPayload = { title: string; body?: string; url?: string; icon?: string }

/** Pošle notifikaci na všechna zařízení uživatele. Neplatné odběry (410/404) smaže. Nikdy nevyhodí chybu. */
export async function sendPush(userId: string, n: PushPayload, { ignoreQuiet = false } = {}) {
  if (!setup()) return { sent: 0, skipped: 'no-keys' as const }
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { isMinor: true, pushNightOk: true, pushSubs: { select: { id: true, endpoint: true, p256dh: true, auth: true } } },
  })
  if (!u?.pushSubs.length) return { sent: 0, skipped: 'no-devices' as const }
  if (!ignoreQuiet && isQuietNow() && quietApplies(u)) return { sent: 0, skipped: 'quiet' as const }
  const payload = JSON.stringify({
    title: [n.icon, n.title].filter(Boolean).join(' ').slice(0, 120),
    body: n.body?.slice(0, 240),
    url: n.url?.startsWith('/') ? n.url : '/upozorneni',
  })
  let sent = 0
  await Promise.all(
    u.pushSubs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 6 * 3600 })
        sent++
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode
        if (code === 404 || code === 410) await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {})
        else console.error('[push]', code ?? err)
      }
    }),
  )
  return { sent }
}

/** Po akci, kde dává smysl nabídnout notifikace (žádost o výměnu, hlídání ceny): prohlížeč pak ukáže dotaz. */
export async function flagPushAsk() {
  ;(await cookies()).set('pk_push_ask', '1', { path: '/', maxAge: 600, sameSite: 'lax' })
}
