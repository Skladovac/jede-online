import 'server-only'
import { headers } from 'next/headers'
import { ipLimitKey } from '@/lib/ip'

// Jednoduchý limit pokusů v paměti procesu (jedna instance aplikace na serveru stačí).
const hits = new Map<string, number[]>()
const MAX_KEYS = 20_000

/**
 * IP klienta pro limit pokusů. Aplikace MUSÍ běžet za reverzní proxy (nginx), která hlavičku x-real-ip vždy přepíše
 * (proxy_set_header X-Real-IP $remote_addr). Na x-forwarded-for se záměrně nespoléháme: první prvek dodává klient,
 * takže by šel podvrhnout a limit obejít. Bez x-real-ip jdou všichni do jednoho společného koše ('unknown') —
 * limit pak raději platí příliš přísně, než aby šel obejít.
 */
export async function clientIp() {
  const h = await headers()
  return ipLimitKey(h.get('x-real-ip') ?? '')
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
