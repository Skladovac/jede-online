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
