import 'server-only'
import { mkdir, rm, writeFile, stat, open } from 'fs/promises'
import { createWriteStream } from 'fs'
import path from 'path'
import { randomBytes } from 'crypto'
import sharp from 'sharp'

// Nahrané fotky a videa leží na disku (v Dockeru svazek /opt/jede/vasirm-media → /app/media).
// Na webu jsou pod /media/... — v produkci je posílá rovnou nginx, lokálně app/media/[...path]/route.ts.

export const MEDIA_DIR = path.resolve(process.env.MEDIA_DIR ?? './media')

/** Šířky, které se z každé fotky vyrobí (jen menší než originál). */
export const IMAGE_WIDTHS = [480, 960, 1600, 2400] as const

export const MAX_IMAGE_BYTES = 40 * 1024 * 1024
export const MAX_VIDEO_BYTES = 600 * 1024 * 1024

const id = () => randomBytes(9).toString('base64url')

/** Bezpečná absolutní cesta uvnitř MEDIA_DIR, jinak null (ochrana proti ../). */
export function mediaPath(rel: string) {
  const abs = path.resolve(MEDIA_DIR, rel)
  return abs.startsWith(MEDIA_DIR + path.sep) ? abs : null
}

export const imageUrl = (listingId: string, imageId: string, w: number) => `/media/l/${listingId}/${imageId}-${w}.webp`

/**
 * Zpracuje fotku: otočí podle EXIF, odstraní metadata (GPS z mobilu!), vyrobí webp ve více šířkách
 * a malý rozmazaný náhled. Vrací rozměry a vygenerované šířky.
 */
export async function processListingImage(listingId: string, imageId: string, input: Buffer) {
  const base = sharp(input, { failOn: 'error' }).rotate()
  const meta = await base.metadata()
  // Po rotate() mají fotky na výšku prohozené rozměry.
  const swap = (meta.orientation ?? 1) >= 5
  const width = (swap ? meta.height : meta.width) ?? 0
  const height = (swap ? meta.width : meta.height) ?? 0
  if (!width || !height) throw new Error('Soubor není obrázek.')

  const dir = path.join(MEDIA_DIR, 'l', listingId)
  await mkdir(dir, { recursive: true })

  const widths: number[] = IMAGE_WIDTHS.filter((w) => w < width)
  // Vždy i jedna velikost v plné (ale max 2400 px) šířce.
  const top = Math.min(width, IMAGE_WIDTHS[IMAGE_WIDTHS.length - 1])
  if (!widths.includes(top)) widths.push(top)

  for (const w of widths) {
    await base
      .clone()
      .resize({ width: w, withoutEnlargement: true })
      .webp({ quality: w <= 960 ? 78 : 82 })
      .toFile(path.join(dir, `${imageId}-${w}.webp`))
  }
  const tiny = await base.clone().resize({ width: 24 }).webp({ quality: 40 }).toBuffer()
  return { width, height, sizes: widths, blur: `data:image/webp;base64,${tiny.toString('base64')}` }
}

export async function deleteListingImageFiles(listingId: string, imageId: string, sizes: number[]) {
  await Promise.all(
    sizes.map((w) => rm(path.join(MEDIA_DIR, 'l', listingId, `${imageId}-${w}.webp`), { force: true })),
  )
}

export async function deleteListingMedia(listingId: string) {
  const dir = mediaPath(path.join('l', listingId))
  if (dir) await rm(dir, { recursive: true, force: true })
}

/** Uloží video proudem na disk (nebere celé do paměti). Vrací cestu relativně k MEDIA_DIR. */
export async function saveVideoStream(listingId: string, body: ReadableStream<Uint8Array>) {
  const rel = path.posix.join('l', listingId, `video-${id()}.mp4`)
  const abs = path.join(MEDIA_DIR, rel)
  await mkdir(path.dirname(abs), { recursive: true })
  const out = createWriteStream(abs)
  let total = 0
  try {
    const reader = body.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_VIDEO_BYTES) throw new Error('Video je větší než 600 MB.')
      if (!out.write(value)) await new Promise<void>((r) => out.once('drain', () => r()))
    }
    await new Promise<void>((resolve, reject) => out.end((err?: Error | null) => (err ? reject(err) : resolve())))
  } catch (err) {
    out.destroy()
    await rm(abs, { force: true })
    throw err
  }
  // MP4 začíná boxem „ftyp“ na 4. bajtu — jiné soubory nebereme.
  const { size } = await stat(abs)
  const head = Buffer.alloc(12)
  const fh = await open(abs, 'r')
  await fh.read(head, 0, 12, 0)
  await fh.close()
  if (size < 1024 || head.subarray(4, 8).toString('latin1') !== 'ftyp') {
    await rm(abs, { force: true })
    throw new Error('Soubor není video MP4.')
  }
  return rel
}

/** Portrét makléře: čtverec 800 px. Vrací URL. */
export async function saveAvatar(userId: string, input: Buffer) {
  const name = `${id()}.webp`
  const dir = path.join(MEDIA_DIR, 'u', userId)
  await mkdir(dir, { recursive: true })
  const buf = await sharp(input, { failOn: 'error' })
    .rotate()
    .resize({ width: 800, height: 1000, fit: 'cover', position: 'attention' })
    .webp({ quality: 82 })
    .toBuffer()
  await writeFile(path.join(dir, name), buf)
  return `/media/u/${userId}/${name}`
}
