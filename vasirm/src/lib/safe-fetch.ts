// Stahování souborů z adres, které přišly zvenku (export z Realmanu). Ochrana proti SSRF:
// jen https a připojení výhradně na veřejné IP — kontrola probíhá až při samotném připojení (po DNS),
// takže ji neobejde ani DNS rebinding, ani přesměrování na vnitřní adresu.
import { lookup as dnsLookup, type LookupAddress } from 'dns'
import { BlockList, isIP } from 'net'
import { Agent, fetch as undiciFetch } from 'undici'

const blocked = new BlockList()
for (const [net, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const)
  blocked.addSubnet(net, prefix, 'ipv4')
for (const [net, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['64:ff9b::', 96],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const)
  blocked.addSubnet(net, prefix, 'ipv6')

/** true = adresa je vnitřní / neveřejná a nesmí se na ni připojovat. */
export function isBlockedAddress(address: string) {
  const family = isIP(address)
  if (!family) return true
  // IPv4 zabalené v IPv6 (::ffff:127.0.0.1 nebo ::ffff:7f00:1) kontrolovat jako IPv4.
  const mapped = family === 6 ? address.match(/^::ffff:(?:(\d+\.\d+\.\d+\.\d+)|([0-9a-f]{1,4}):([0-9a-f]{1,4}))$/i) : null
  if (mapped) {
    const v4 = mapped[1] ?? [mapped[2], mapped[3]].flatMap((h) => [parseInt(h, 16) >> 8, parseInt(h, 16) & 255]).join('.')
    return blocked.check(v4, 'ipv4')
  }
  return blocked.check(address, family === 6 ? 'ipv6' : 'ipv4')
}

type LookupCb = (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void

function safeLookup(hostname: string, options: { all?: boolean; family?: number }, cb: LookupCb) {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return cb(err, '')
    const list = addresses as LookupAddress[]
    if (!list.length || list.some((a) => isBlockedAddress(a.address))) {
      return cb(Object.assign(new Error(`Adresa ${hostname} vede na neveřejnou síť.`), { code: 'EBLOCKED' }), '')
    }
    if (options.all) return cb(null, list)
    cb(null, list[0].address, list[0].family)
  })
}

const agent = new Agent({ connect: { lookup: safeLookup as never }, maxRedirections: 0 })

/** fetch jen na veřejné https adresy; nejvýš 3 přesměrování, každé znovu ověřené. */
export async function safeFetch(raw: string, timeoutMs: number) {
  let url = new URL(raw)
  for (let hop = 0; hop <= 3; hop++) {
    if (url.protocol !== 'https:') throw new Error('Soubor není na https.')
    const host = url.hostname.replace(/^\[|\]$/g, '')
    if (isIP(host) && isBlockedAddress(host)) throw new Error('Neplatná adresa souboru.')
    let res
    try {
      res = await undiciFetch(url, { dispatcher: agent, redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) })
    } catch (e) {
      // undici balí chyby do „fetch failed“ — skutečný důvod je v cause.
      const cause = e instanceof Error && e.cause instanceof Error ? e.cause : e
      throw new Error(cause instanceof Error ? cause.message : 'Stažení selhalo.')
    }
    const location = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null
    if (!location) return res
    await res.body?.cancel()
    url = new URL(location, url)
  }
  throw new Error('Příliš mnoho přesměrování.')
}
