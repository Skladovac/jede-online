import 'server-only'
import { readFile } from 'fs/promises'
import path from 'path'

// Náhledové obrázky pro Facebook, WhatsApp, Messenger… (1200×630).
export const OG_SIZE = { width: 1200, height: 630 }
export const APP_URL = 'https://pokemon.jede.online'

/**
 * Písmo s českou diakritikou: Google Fonts umí vrátit TTF jen se znaky, které potřebujeme (&text=).
 * Když se stažení nepovede, ImageResponse použije vestavěné písmo (bez háčků, ale obrázek vznikne).
 */
export async function ogFont(text: string, weight: 400 | 800) {
  try {
    const css = await (
      await fetch(`https://fonts.googleapis.com/css2?family=Nunito:wght@${weight}&text=${encodeURIComponent(text)}`, {
        next: { revalidate: 86400 },
      })
    ).text()
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1]
    if (!url) return null
    return { name: 'Nunito', data: await (await fetch(url)).arrayBuffer(), weight, style: 'normal' as const }
  } catch {
    return null
  }
}

export async function ogFonts(text: string) {
  return (await Promise.all([ogFont(text, 400), ogFont(text, 800)])).filter((f) => !!f)
}

let logoCache: string | null = null
/** Logo webu jako data URI (satori neumí relativní cesty). */
export async function ogLogo() {
  logoCache ??= `data:image/svg+xml;base64,${(await readFile(path.join(process.cwd(), 'public/logo.svg'))).toString('base64')}`
  return logoCache
}

/** PNG verze obrázku karty přes naši nginx keš (satori neumí webp). */
export function ogCardImage(url: string | null) {
  if (!url) return null
  if (url.startsWith('https://assets.tcgdex.net/')) return `${APP_URL}/img/${url.slice('https://assets.tcgdex.net/'.length)}/low.png`
  if (url.startsWith('https://images.pokemontcg.io/')) return `${APP_URL}/img2/${url.slice('https://images.pokemontcg.io/'.length)}`
  return null
}

/** „Chybí 1 karta / 3 karty / 7 karet“ */
export const cardsCz = (n: number) => `${n} ${n === 1 ? 'karta' : n >= 2 && n <= 4 ? 'karty' : 'karet'}`
