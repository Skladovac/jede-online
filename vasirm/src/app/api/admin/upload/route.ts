import { NextResponse } from 'next/server'
import { rm } from 'fs/promises'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { MAX_IMAGE_BYTES, mediaPath, processListingImage, saveAvatar, saveVideoStream } from '@/lib/media'

export const dynamic = 'force-dynamic'

// Nahrávání z administrace: tělo požadavku = soubor (ne multipart), jeden soubor na požadavek.
// ?kind=image&listingId=…  |  ?kind=video&listingId=…  |  ?kind=avatar

const err = (message: string, status = 400) => NextResponse.json({ error: message }, { status })

async function readLimited(req: Request, max: number) {
  const len = Number(req.headers.get('content-length') ?? 0)
  if (len > max) throw new Error('Soubor je moc velký (max. 40 MB).')
  const buf = Buffer.from(await req.arrayBuffer())
  if (buf.byteLength > max) throw new Error('Soubor je moc velký (max. 40 MB).')
  return buf
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return err('Nejste přihlášeni.', 401)
  // Ochrana proti odeslání z cizího webu (cookie je SameSite=Lax, ale POST přes fetch kontrolujeme i tak).
  const origin = req.headers.get('origin')
  if (origin && new URL(origin).host !== req.headers.get('host')) return err('Neplatný původ požadavku.', 403)

  const url = new URL(req.url)
  const kind = url.searchParams.get('kind')

  try {
    if (kind === 'avatar') {
      const photo = await saveAvatar(user.id, await readLimited(req, MAX_IMAGE_BYTES))
      const old = user.photo
      await prisma.user.update({ where: { id: user.id }, data: { photo } })
      if (old?.startsWith('/media/')) {
        const abs = mediaPath(old.slice('/media/'.length))
        if (abs) await rm(abs, { force: true })
      }
      return NextResponse.json({ photo })
    }

    const listingId = url.searchParams.get('listingId') ?? ''
    const listing = await prisma.listing.findUnique({ where: { id: listingId }, select: { id: true, title: true, locality: true, videoPath: true, source: true } })
    if (!listing) return err('Nemovitost neexistuje.', 404)
    if (listing.source === 'REALMAN') return err('Fotky nemovitosti z Realmanu se nahrávají v Realmanu.', 403)

    if (kind === 'image') {
      const input = await readLimited(req, MAX_IMAGE_BYTES)
      const last = await prisma.listingImage.findFirst({ where: { listingId }, orderBy: { sort: 'desc' }, select: { sort: true } })
      const count = await prisma.listingImage.count({ where: { listingId } })
      const img = await prisma.listingImage.create({
        data: {
          listingId,
          sort: (last?.sort ?? -1) + 1,
          width: 0,
          height: 0,
          sizes: [],
          alt: `${listing.title}${listing.locality ? `, ${listing.locality}` : ''} — foto ${count + 1}`,
        },
      })
      try {
        const out = await processListingImage(listingId, img.id, input)
        const saved = await prisma.listingImage.update({ where: { id: img.id }, data: out })
        return NextResponse.json({ image: saved })
      } catch (e) {
        await prisma.listingImage.delete({ where: { id: img.id } })
        console.error('[upload] zpracování fotky selhalo', e)
        return err('Tenhle soubor neumím zpracovat. Nahrajte prosím fotku ve formátu JPG, PNG nebo WebP.')
      }
    }

    if (kind === 'video') {
      if (!req.body) return err('Chybí soubor.')
      const rel = await saveVideoStream(listingId, req.body)
      if (listing.videoPath) {
        const abs = mediaPath(listing.videoPath)
        if (abs) await rm(abs, { force: true })
      }
      await prisma.listing.update({ where: { id: listingId }, data: { videoPath: rel } })
      return NextResponse.json({ videoPath: rel })
    }

    return err('Neznámý typ souboru.')
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Nahrání se nepovedlo.')
  }
}
