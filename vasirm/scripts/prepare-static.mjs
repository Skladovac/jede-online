// Jednorázová příprava statických obrázků do public/img ze zdrojových fotek (stažených ze starého webu).
// Použití: node scripts/prepare-static.mjs <složka se zdroji>
// Fotky nemovitostí sem nepatří — ty jdou přes administraci / import (lib/media.ts).
import sharp from 'sharp'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'

const SRC = process.argv[2]
if (!SRC) throw new Error('Zadej složku se zdroji.')
const OUT = path.resolve('public/img')
const src = (f) => path.join(SRC, f)

async function sizes(file, name, widths, extract) {
  await mkdir(path.dirname(path.join(OUT, name)), { recursive: true })
  for (const w of widths) {
    let img = sharp(src(file)).rotate()
    if (extract) img = img.extract(extract)
    await img.resize({ width: w }).webp({ quality: 80 }).toFile(path.join(OUT, `${name}-${w}.webp`))
  }
}

// Hlavní fotka: novostavba v Lukově (dům se zahradou a terasou).
await sizes('DSC03863-scaled.jpg', 'hero/lukov', [960, 1600, 2400])
await sizes('DSC03949-scaled.jpg', 'hero/terasa', [960, 1600])
await sizes('DSC03967-HDR-2-Edit-scaled.jpg', 'hero/interier', [960, 1600])
await sizes('DJI_20260418075125_0148_D-scaled.jpg', 'hero/lukov-dron', [960, 1600])

// Portréty: ořez na horní polovinu postavy (4:5) a celé fotky na stránku O nás.
await sizes('muz.jpg-scaled.jpg', 'team/ondrej', [480, 800], { left: 650, top: 420, width: 1057, height: 1321 })
await sizes('zena.jpg-scaled.jpg', 'team/marketa', [480, 800], { left: 400, top: 430, width: 1080, height: 1350 })
await sizes('muz.jpg-scaled.jpg', 'team/ondrej-cely', [700, 1100])
await sizes('zena.jpg-scaled.jpg', 'team/marketa-cela', [700, 1100])
await sizes('DSC04438opr-rovna-scaled.jpg', 'team/par', [960, 1600])

// Logo: monogram „vrm“ zvlášť (řádky 0–182) a celé logo. Bílé na průhledném — na webu se barví přes CSS masku.
await sharp(src('LOGO.png')).extract({ left: 0, top: 0, width: 670, height: 183 }).png().toFile(path.join(OUT, 'logo-mark.png'))
await sharp(src('LOGO.png')).png().toFile(path.join(OUT, 'logo.png'))

// Ikona webu: zlatý monogram na tmavě modrém čtverci.
async function icon(size, file) {
  // Zlatý obdélník oříznutý tvarem monogramu (alfa kanál loga).
  const alpha = await sharp(src('LOGO.png'))
    .extract({ left: 0, top: 0, width: 670, height: 183 })
    .resize({ width: Math.round(size * 0.74) })
    .png()
    .toBuffer()
  const { width, height } = await sharp(alpha).metadata()
  const mark = await sharp({ create: { width, height, channels: 4, background: '#c5a880' } })
    .composite([{ input: alpha, blend: 'dest-in' }])
    .png()
    .toBuffer()
  await sharp({ create: { width: size, height: size, channels: 4, background: '#001a3b' } })
    .composite([{ input: mark, gravity: 'center' }])
    .png()
    .toFile(file)
}
await icon(512, path.resolve('src/app/icon.png'))
await icon(180, path.resolve('src/app/apple-icon.png'))

// Obrázek pro sdílení (Facebook, WhatsApp): fotka domu ztmavená zleva + logo.
const W = 1200
const H = 630
const photo = await sharp(src('DSC03863-scaled.jpg')).resize({ width: W, height: H, fit: 'cover' }).toBuffer()
const shade = Buffer.from(
  `<svg width="${W}" height="${H}"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#001a3b" stop-opacity=".92"/><stop offset=".55" stop-color="#001a3b" stop-opacity=".6"/><stop offset="1" stop-color="#001a3b" stop-opacity=".05"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><rect x="72" y="${H - 96}" width="64" height="2" fill="#c5a880"/></svg>`,
)
const logo = await sharp(src('LOGO.png')).resize({ width: 420 }).png().toBuffer()
await writeFile(
  path.resolve('src/app/opengraph-image.jpg'),
  await sharp(photo)
    .composite([
      { input: shade, left: 0, top: 0 },
      { input: logo, left: 72, top: 200 },
    ])
    .jpeg({ quality: 82 })
    .toBuffer(),
)
console.log('hotovo')
