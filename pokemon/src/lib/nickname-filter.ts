import 'server-only'
import { prisma } from '@/lib/prisma'

/**
 * Zakázaná slova v přezdívkách (čeština, slovenština, angličtina). Porovnává se bez diakritiky,
 * s převodem "leet" znaků (k0k0t, s3x) a bez opakovaných písmen (kuuurva). Správce může
 * v administraci přidat další slova (tabulka BannedWord).
 * Záměrně jen delší a jednoznačná slova, ať neblokujeme nevinné přezdívky.
 */
const DEFAULT_WORDS = [
  // čeština / slovenština
  'kurva', 'kurvy', 'zkurv', 'pica', 'pice', 'picu', 'picus', 'kokot', 'kokut', 'hovno', 'hovna', 'prdel',
  'sracka', 'srac', 'curak', 'cural', 'mrdat', 'mrdka', 'mrdk', 'jebat', 'jebal', 'jebak', 'jebem', 'zmrd',
  'debil', 'kreten', 'idiot', 'buzna', 'buzerant', 'pizda', 'kunda', 'chuj', 'skurv', 'kurvi', 'negr', 'cigos',
  'hajzl', 'zasran', 'posran', 'onanie', 'masturb',
  // angličtina
  'fuck', 'shit', 'bitch', 'cunt', 'pussy', 'whore', 'slut', 'nigger', 'nigga', 'faggot', 'retard', 'porn',
  'penis', 'vagina', 'dildo', 'boobs', 'cock',
  // jiné nevhodné
  'hitler', 'nazi', 'heilhitler',
  // vydávání se za správu webu
  'admin', 'moderator', 'spravce', 'jedeonline',
]

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', $: 's', '!': 'i' }

export function normalizeNick(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[0134578@$!]/g, (c) => LEET[c] ?? c)
    .replace(/[^a-z]/g, '') // tečky, podtržítka, pomlčky: "s.r.a.c" → "srac"
    .replace(/(.)\1+/g, '$1') // "kuuurva" → "kurva"
}

let cache: { words: string[]; at: number } | null = null

async function bannedWords() {
  if (cache && Date.now() - cache.at < 5 * 60_000) return cache.words
  const extra = await prisma.bannedWord.findMany({ select: { word: true } })
  const words = [...new Set([...DEFAULT_WORDS, ...extra.map((w) => w.word)].map(normalizeNick).filter((w) => w.length >= 3))]
  cache = { words, at: Date.now() }
  return words
}

export const invalidateBannedWords = () => {
  cache = null
}

/** Vrací zakázané slovo, které přezdívka obsahuje, nebo null. */
export async function nicknameProblem(nickname: string) {
  const n = normalizeNick(nickname)
  const words = await bannedWords()
  return words.find((w) => n.includes(w)) ?? null
}

export const DEFAULT_BANNED_WORDS = DEFAULT_WORDS
