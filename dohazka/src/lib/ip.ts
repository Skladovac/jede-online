// Čistá funkce bez server-only (testuje se ve vitestu): klíč pro limit pokusů podle IP adresy.

/** Rozbalí IPv6 na osm hextetů (čísla), nebo vrátí null, když adresa není platná. */
function rozbalIPv6(adresa: string): number[] | null {
  let a = adresa
  // Vložená IPv4 na konci (::ffff:1.2.3.4) -> dva hexety.
  const v4 = a.match(/^(.*:)(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (v4) {
    const o = v4.slice(2).map(Number)
    if (o.some((n) => n > 255)) return null
    a = `${v4[1]}${((o[0] << 8) | o[1]).toString(16)}:${((o[2] << 8) | o[3]).toString(16)}`
  }
  const casti = a.split('::')
  if (casti.length > 2) return null
  const hexety = (s: string) => (s === '' ? [] : s.split(':'))
  const levy = hexety(casti[0])
  const pravy = casti.length === 2 ? hexety(casti[1]) : []
  const chybi = 8 - levy.length - pravy.length
  if (casti.length === 2 ? chybi < 1 : chybi !== 0) return null
  const vse = [...levy, ...Array<string>(casti.length === 2 ? chybi : 0).fill('0'), ...pravy]
  if (vse.length !== 8 || vse.some((h) => !/^[0-9a-f]{1,4}$/i.test(h))) return null
  return vse.map((h) => parseInt(h, 16))
}

/**
 * Klíč pro limit: IPv4 beze změny, IPv4-mapped IPv6 (::ffff:1.2.3.4) jako obyčejná IPv4,
 * jinak první čtyři hexety (/64) — jeden uživatel má celý blok, ne jednu adresu.
 * Zkrácené zápisy ("2001:db8::1") se nejdřív rozbalí, takže stejný blok dá vždy stejný klíč.
 */
export function ipLimitKey(raw: string): string {
  const ip = raw.trim().replace(/^\[|\]$/g, '').split('%')[0]
  if (!ip.includes(':')) return ip || 'unknown'
  const h = rozbalIPv6(ip)
  if (!h) return 'unknown'
  if (h.slice(0, 5).every((x) => x === 0) && h[5] === 0xffff) {
    return `${h[6] >> 8}.${h[6] & 255}.${h[7] >> 8}.${h[7] & 255}`
  }
  return h.slice(0, 4).map((x) => x.toString(16)).join(':') + '::/64'
}
