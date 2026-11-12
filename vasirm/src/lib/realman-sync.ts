import 'server-only'
import { rm } from 'fs/promises'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { slugify } from '@/lib/format'
import { MAX_IMAGE_BYTES, deleteListingImageFiles, mediaPath, processListingImage, saveVideoStream } from '@/lib/media'
import { mapEstate, type MappedEstate, type RealmanPhoto, type RealmanVideo } from '@/lib/realman'
import { safeFetch } from '@/lib/safe-fetch'

// Příjem exportu z Realmanu. Odpověď Realmanu musí přijít hned, takže se uloží jen údaje nemovitosti
// a fotky / video se stahují až potom ve frontě (po jednom — malý server, sharp bere hodně paměti).
// Odkazy na soubory mají omezenou platnost: nepovedené stažení se zkusí ještě 2× a pak čeká na další export.

const MAX_ATTEMPTS = 3

type MediaPayload = { photos: RealmanPhoto[]; video: RealmanVideo | null }

export class RealmanError extends Error {}

/** Najde makléře podle e-mailu z Realmanu (přihlašovací nebo veřejný e-mail). */
async function findAgent(email: string) {
  if (!email) return null
  const u = await prisma.user.findFirst({
    where: { OR: [{ email: { equals: email, mode: 'insensitive' } }, { publicEmail: { equals: email, mode: 'insensitive' } }] },
    select: { id: true },
  })
  return u?.id ?? null
}

async function uniqueSlug(base: string) {
  // Název často obsahuje obec a lokalita taky („…, Zlín“ + „Zlín – Chlum“) — zdvojené slovo vynechat.
  const root =
    slugify(base)
      .split('-')
      .filter((w, i, all) => w !== all[i - 1])
      .join('-') || 'nemovitost'
  let slug = root
  for (let i = 2; await prisma.listing.findUnique({ where: { slug }, select: { id: true } }); i++) slug = `${root}-${i}`
  return slug
}

/** Uloží (založí / aktualizuje) nemovitost z exportu. Fotky a video jen naplánuje. */
export async function upsertFromRealman(externalId: string, payload: unknown) {
  const m: MappedEstate = mapEstate(payload)
  if (m.isProject) throw new RealmanError('Developerské projekty web zatím nezobrazuje.')
  if (!m.locality) throw new RealmanError('V nabídce chybí obec (locality_city).')

  const agentId = await findAgent(m.sellerEmail)
  const media: MediaPayload = { photos: m.photos, video: m.video }
  const now = new Date()
  const data = {
    title: m.title,
    offerType: m.offerType,
    propertyType: m.propertyType,
    status: m.status,
    price: m.price,
    priceNote: m.priceNote,
    usableArea: m.usableArea,
    landArea: m.landArea,
    disposition: m.disposition,
    energyClass: m.energyClass,
    description: m.description,
    locality: m.locality,
    mapQuery: m.mapQuery,
    params: m.params,
    videoUrl: m.video?.kind === 'youtube' ? `https://www.youtube-nocookie.com/embed/${m.video.id}` : null,
    externalUpdated: m.updated || null,
    agentId,
    syncState: 'pending',
    syncError: '',
    syncAttempts: 0,
    syncPayload: media as unknown as Prisma.InputJsonValue,
  }

  const existing = await prisma.listing.findUnique({ where: { externalId }, select: { id: true, soldAt: true } })
  if (existing) {
    return prisma.listing.update({
      where: { id: existing.id },
      data: { ...data, soldAt: m.status === 'SOLD' ? (existing.soldAt ?? now) : null },
    })
  }
  return prisma.listing.create({
    data: {
      ...data,
      source: 'REALMAN',
      externalId,
      slug: await uniqueSlug(`${m.title} ${m.locality}`),
      publishedAt: now,
      soldAt: m.status === 'SOLD' ? now : null,
    },
  })
}

/** Realman zakázku stáhl z exportu → na webu „Prodáno“ (smazat ji jde ručně v administraci). */
export async function markWithdrawn(externalId: string) {
  const l = await prisma.listing.findUnique({ where: { externalId }, select: { id: true, soldAt: true } })
  if (!l) return null
  return prisma.listing.update({ where: { id: l.id }, data: { status: 'SOLD', soldAt: l.soldAt ?? new Date() } })
}

export async function logRealman(entry: { externalId: string; method: string; ok: boolean; message: string; listingId?: string | null; ip?: string }) {
  await prisma.realmanLog.create({ data: { ...entry, message: entry.message.slice(0, 500) } }).catch((e) => console.error('[realman] log', e))
}

// ───────────── stahování souborů ─────────────

async function download(url: string, maxBytes: number) {
  const res = await safeFetch(url, 90_000)
  if (!res.ok) throw new Error(`Stažení selhalo (${res.status}) — odkaz už možná vypršel.`)
  const len = Number(res.headers.get('content-length') ?? 0)
  if (len > maxBytes) throw new Error('Soubor je příliš velký.')
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.byteLength > maxBytes) throw new Error('Soubor je příliš velký.')
  return buf
}

/** Stáhne chybějící fotky, srovná pořadí a popisky, smaže fotky, které v Realmanu už nejsou; totéž s videem. */
export async function syncMedia(listingId: string) {
  const l = await prisma.listing.findUnique({ where: { id: listingId }, include: { images: true } })
  if (!l || l.source !== 'REALMAN' || l.syncState === 'ok' || !l.syncPayload) return
  const media = l.syncPayload as unknown as MediaPayload
  const errors: string[] = []
  const wanted = new Set(media.photos.map((p) => p.hash))

  // Smazat fotky, které už v exportu nejsou.
  for (const img of l.images.filter((i) => !i.externalHash || !wanted.has(i.externalHash))) {
    await prisma.listingImage.delete({ where: { id: img.id } })
    await deleteListingImageFiles(l.id, img.id, img.sizes)
  }

  for (const [sort, p] of media.photos.entries()) {
    const alt = p.title || `${l.title}, ${l.locality} — foto ${sort + 1}`
    const have = l.images.find((i) => i.externalHash === p.hash && i.sizes.length)
    if (have) {
      await prisma.listingImage.update({ where: { id: have.id }, data: { sort, alt } })
      continue
    }
    try {
      const input = await download(p.url, MAX_IMAGE_BYTES)
      const img = await prisma.listingImage.create({ data: { listingId: l.id, sort, width: 0, height: 0, sizes: [], alt, externalHash: p.hash } })
      try {
        await prisma.listingImage.update({ where: { id: img.id }, data: await processListingImage(l.id, img.id, input) })
      } catch (e) {
        await prisma.listingImage.delete({ where: { id: img.id } })
        throw e
      }
    } catch (e) {
      errors.push(`foto ${sort + 1}: ${e instanceof Error ? e.message : 'chyba'}`)
    }
  }

  // Video: soubor stáhnout jen když se změnil; YouTube / žádné video = smazat případný starý soubor.
  const dropVideoFile = async () => {
    if (!l.videoPath) return
    const abs = mediaPath(l.videoPath)
    if (abs) await rm(abs, { force: true })
    await prisma.listing.update({ where: { id: l.id }, data: { videoPath: null, videoSourceKey: null } })
  }
  if (media.video?.kind === 'file') {
    if (media.video.key !== l.videoSourceKey || !l.videoPath) {
      try {
        const res = await safeFetch(media.video.url, 15 * 60_000)
        if (!res.ok || !res.body) throw new Error(`Stažení videa selhalo (${res.status}).`)
        const rel = await saveVideoStream(l.id, res.body as unknown as ReadableStream<Uint8Array>)
        await dropVideoFile()
        await prisma.listing.update({ where: { id: l.id }, data: { videoPath: rel, videoSourceKey: media.video.key } })
      } catch (e) {
        errors.push(`video: ${e instanceof Error ? e.message : 'chyba'}`)
      }
    }
  } else {
    await dropVideoFile()
  }

  if (!errors.length) {
    await prisma.listing.update({ where: { id: l.id }, data: { syncState: 'ok', syncError: '', syncAttempts: 0, syncPayload: Prisma.DbNull } })
    return
  }
  const attempts = l.syncAttempts + 1
  await prisma.listing.update({
    where: { id: l.id },
    data: { syncState: attempts >= MAX_ATTEMPTS ? 'error' : 'pending', syncAttempts: attempts, syncError: errors.join('; ').slice(0, 1000) },
  })
  console.error(`[realman] ${l.externalId}: ${errors.join('; ')}`)
}

// ───────────── fronta ─────────────

const g = globalThis as unknown as { realmanQueue?: Promise<void>; realmanQueued?: Set<string>; realmanTimer?: NodeJS.Timeout }
g.realmanQueue ??= Promise.resolve()
g.realmanQueued ??= new Set()

/** Zařadí stažení médií; stejná nemovitost ve frontě jen jednou. */
export function enqueueSync(listingId: string) {
  if (g.realmanQueued!.has(listingId)) return
  g.realmanQueued!.add(listingId)
  g.realmanQueue = g
    .realmanQueue!.then(async () => {
      g.realmanQueued!.delete(listingId)
      await syncMedia(listingId)
    })
    .catch((e) => console.error('[realman] sync', e))
}

/** Dokončit rozpracované (např. po restartu kontejneru) a uklidit starý záznam volání. */
export async function sweepPending() {
  const pending = await prisma.listing.findMany({ where: { source: 'REALMAN', syncState: 'pending' }, select: { id: true } })
  pending.forEach((p) => enqueueSync(p.id))
  await prisma.realmanLog.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 90 * 86_400_000) } } })
}

/** Spustí se jednou za běh serveru (volá ho /api/health po nasazení a příjem exportu). */
export function startSweeper() {
  if (g.realmanTimer) return
  g.realmanTimer = setInterval(() => sweepPending().catch((e) => console.error('[realman] sweep', e)), 10 * 60_000)
  g.realmanTimer.unref?.()
  setTimeout(() => sweepPending().catch((e) => console.error('[realman] sweep', e)), 20_000).unref?.()
}
