// Jednorázový skript na (znovu)vyrobení ikon aplikace: npx tsx scripts/make-icons.ts
// `sharp` NENÍ v package.json (nativní binárka by se zbytečně stahovala při každém buildu). Přichází jen jako
// VOLITELNÁ závislost Next.js a může zmizet; pak před spuštěním: npm i -D sharp (a pak ho zase nezapisovat).
// Skript slouží jen k regeneraci public/icons/*.png (výsledky jsou commitnuté) a není součástí buildu.
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const ACCENT = '#2f5d8a' // --accent z src/app/globals.css

// Čtverec bez zaoblení (iOS si ikonu maskuje sám), bílé písmeno D jako monogram.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${ACCENT}"/>
  <text x="256" y="256" text-anchor="middle" dominant-baseline="central" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="320" fill="#ffffff">D</text>
</svg>`

const out = join(process.cwd(), 'public', 'icons')
mkdirSync(out, { recursive: true })
async function main() {
  for (const size of [192, 512]) {
    await sharp(Buffer.from(svg)).resize(size, size).png().toFile(join(out, `icon-${size}.png`))
  }
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
