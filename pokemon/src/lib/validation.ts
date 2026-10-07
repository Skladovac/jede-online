import { REGIONS } from '@/lib/regions'

export type FormState = { error?: string; ok?: string; fields?: Record<string, string> } | undefined

export const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim()

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
// Přezdívka je veřejná — žádné mezery ani speciální znaky, ať se nedá vydávat za někoho jiného zalomením.
export const NICK_RE = /^[\p{L}\p{N}_-]{3,20}$/u

export function checkPassword(pw: string) {
  if (pw.length < 8) return 'Heslo musí mít aspoň 8 znaků.'
  if (pw.length > 200) return 'Heslo je příliš dlouhé.'
  return null
}

export function checkRegion(country: string, region: string) {
  if (!region) return true
  return (REGIONS[country as keyof typeof REGIONS] as readonly string[] | undefined)?.includes(region) ?? false
}

const SOCIAL_HOSTS = {
  facebookUrl: ['facebook.com', 'www.facebook.com', 'm.facebook.com', 'fb.com'],
  instagramUrl: ['instagram.com', 'www.instagram.com'],
  aukroUrl: ['aukro.cz', 'www.aukro.cz', 'aukro.sk', 'www.aukro.sk'],
} as const
export type SocialField = keyof typeof SOCIAL_HOSTS
export const SOCIAL_FIELDS = Object.keys(SOCIAL_HOSTS) as SocialField[]

/** Prázdné = null. Jinak jen https odkaz na danou službu (žádné odkazy na cizí weby). */
export function parseSocial(field: SocialField, value: string): { url: string | null } | { error: string } {
  if (!value) return { url: null }
  try {
    const u = new URL(value.startsWith('http') ? value : `https://${value}`)
    if (!(SOCIAL_HOSTS[field] as readonly string[]).includes(u.hostname.toLowerCase())) throw new Error()
    u.protocol = 'https:'
    return { url: u.toString() }
  } catch {
    return { error: 'Odkaz musí vést na Facebook, Instagram nebo Aukro (podle pole).' }
  }
}

/** Telefon: povolené číslice, mezery, pomlčky a + na začátku; 9–15 číslic. Ukládá se bez mezer. */
export function parsePhone(raw: string): { phone: string | null } | { error: string } {
  const v = raw.trim()
  if (!v) return { phone: null }
  if (!/^\+?[\d\s-]+$/.test(v)) return { error: 'Telefon může obsahovat jen číslice, mezery a + na začátku.' }
  const phone = v.replace(/[\s-]/g, '')
  const digits = phone.replace('+', '').length
  if (digits < 9 || digits > 15) return { error: 'Telefon nevypadá správně (9–15 číslic).' }
  return { phone }
}

/** +420777123456 → +420 777 123 456 */
export function formatPhone(p: string) {
  const m = p.match(/^(\+\d{3})?(\d+)$/)
  if (!m) return p
  const rest = m[2].replace(/(\d{3})(?=\d)/g, '$1 ')
  return m[1] ? `${m[1]} ${rest}` : rest
}
