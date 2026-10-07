import 'server-only'
import { headers } from 'next/headers'

// Jednoduchý limit pokusů v paměti procesu (jedna instance aplikace na serveru stačí).
const hits = new Map<string, number[]>()

export async function clientIp() {
  const h = await headers()
  return h.get('x-real-ip') ?? h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
}

/** true = ještě smí. Např. rateLimit('login:1.2.3.4', 10, 15 * 60_000). */
export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now()
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
  if (list.length >= max) {
    hits.set(key, list)
    return false
  }
  list.push(now)
  hits.set(key, list)
  if (hits.size > 10_000) hits.clear() // pojistka proti růstu paměti
  return true
}
