import 'server-only'
import webpush from 'web-push'
import { prisma } from '@/lib/prisma'

/**
 * Push notifikace (Web Push, vlastní VAPID klíče — bez cizí služby).
 * Připomínka pípá každý den v nastavenou hodinu, takže tu není žádný noční klid ani časové okno.
 */

export const pushPublicKey = () => process.env.VAPID_PUBLIC_KEY || null

/** Odběr musí mířit na skutečnou push službu prohlížeče (server na endpoint posílá požadavky — ochrana proti SSRF). */
export function isPushEndpoint(endpoint: string) {
  let u: URL
  try {
    u = new URL(endpoint)
  } catch {
    return false
  }
  if (u.protocol !== 'https:' || u.port || u.username || u.password) return false
  const host = u.hostname.toLowerCase().replace(/\.$/, '')
  return (
    ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com'].includes(host) ||
    host.endsWith('.notify.windows.com') ||
    host.endsWith('.push.apple.com')
  )
}

let ready: boolean | null = null
function setup() {
  if (ready !== null) return ready
  const pub = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  ready = !!(pub && priv)
  if (ready) webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'https://dohazka.jede.online', pub!, priv!)
  return ready
}

type PushPayload = { title: string; body?: string; url?: string }

/** Pošle notifikaci na všechna zařízení uživatele. Neplatné odběry (410/404) smaže. Nikdy nevyhodí chybu. */
export async function sendPush(userId: string, n: PushPayload): Promise<{ sent: number; skipped?: string }> {
  try {
    if (!setup()) return { sent: 0, skipped: 'no-keys' }
    const subs = await prisma.pushSubscription.findMany({
      where: { userId },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    })
    if (!subs.length) return { sent: 0, skipped: 'no-devices' }
    const payload = JSON.stringify({
      title: n.title.slice(0, 120),
      body: n.body?.slice(0, 240),
      url: n.url?.startsWith('/') ? n.url : '/',
    })
    let sent = 0
    await Promise.all(
      subs.map(async (s) => {
        if (!isPushEndpoint(s.endpoint)) return
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 6 * 3600 })
          sent++
        } catch (err) {
          const code = (err as { statusCode?: number }).statusCode
          if (code === 404 || code === 410) await prisma.pushSubscription.deleteMany({ where: { id: s.id, userId } }).catch(() => {})
          else console.error('[push]', code ?? err)
        }
      }),
    )
    return { sent }
  } catch (err) {
    console.error('[push]', err)
    return { sent: 0, skipped: 'error' }
  }
}
