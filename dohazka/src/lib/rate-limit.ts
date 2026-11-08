import 'server-only'
import { headers } from 'next/headers'

// Jednoduchý limit pokusů v paměti procesu (jedna instance aplikace na serveru stačí).
const hits = new Map<string, number[]>()
const MAX_KEYS = 20_000

export async function clientIp() {
  const h = await headers()
  const ip = h.get('x-real-ip') ?? h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  // IPv6: jeden uživatel má celý blok /64 — limit počítáme za blok, ne za adresu.
  return ip.includes(':') ? ip.split(':').slice(0, 4).join(':') + '::/64' : ip
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
  hits.delete(key) // přesunout na konec (Map drží pořadí vložení)
  hits.set(key, list)
  // Pojistka proti růstu paměti: zahodit nejdéle nepoužité klíče, ne všechny (jinak by šly limity vynulovat).
  if (hits.size > MAX_KEYS) {
    for (const k of hits.keys()) {
      hits.delete(k)
      if (hits.size <= MAX_KEYS * 0.9) break
    }
  }
  return true
}
