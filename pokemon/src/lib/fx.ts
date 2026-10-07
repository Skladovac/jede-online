import 'server-only'
import { setCzkRate } from '@/lib/format'

// Kurz EUR/CZK z denního kurzovního lístku ČNB (vyhlašuje se v pracovní dny po 14:30).
const CNB_URL =
  'https://www.cnb.cz/cs/financni-trhy/devizovy-trh/kurzy-devizoveho-trhu/kurzy-devizoveho-trhu/denni_kurz.txt'
const TTL = 3 * 60 * 60_000

let cache: { rate: number; date: string; at: number } | null = null

/**
 * Načte (a na 3 hodiny zapamatuje) kurz EUR/CZK. Volá se na začátku stránky,
 * formatEur() pak kurz čte synchronně. Když ČNB neodpoví, zůstane poslední známý kurz.
 */
export async function ensureEurCzk() {
  if (cache && Date.now() - cache.at < TTL) return cache
  try {
    const txt = await (await fetch(CNB_URL, { cache: 'no-store', signal: AbortSignal.timeout(5000) })).text()
    const date = txt.split('\n')[0]?.split(' ')[0] ?? ''
    const line = txt.split('\n').find((l) => l.includes('|EUR|'))
    const [, , amount, , rate] = line?.split('|') ?? []
    const r = Number(rate?.replace(',', '.')) / Number(amount)
    if (r > 0) {
      cache = { rate: r, date, at: Date.now() }
      setCzkRate(r)
    }
  } catch {
    /* necháme poslední známý kurz */
  }
  return cache
}

export const eurCzkRate = () => cache?.rate ?? null
export const eurCzkDate = () => cache?.date ?? null
