'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { LeadStatus, ListingStatus, OfferType, PropertyType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createSession, destroySession, hashPassword, requireUser, verifyPassword } from '@/lib/auth'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { deleteListingImageFiles, deleteListingMedia, mediaPath } from '@/lib/media'
import { ENERGY_CLASSES, slugify } from '@/lib/format'
import { rm } from 'fs/promises'

export type AdminState = { ok?: boolean; error?: string; message?: string }

const str = (fd: FormData, k: string, max = 300) => String(fd.get(k) ?? '').trim().slice(0, max)
const int = (fd: FormData, k: string) => {
  const v = str(fd, k, 20).replace(/[^\d]/g, '')
  return v ? Math.min(Number(v), 2_000_000_000) : null
}

// ───────────── přihlášení ─────────────

let dummy: Promise<string> | null = null
const dummyHash = () => (dummy ??= hashPassword('nikdy-nepouzite-heslo'))

export async function login(_: AdminState, fd: FormData): Promise<AdminState> {
  const email = str(fd, 'email', 120).toLowerCase()
  const password = String(fd.get('password') ?? '')
  const ip = await clientIp()
  if (!rateLimit(`login:${ip}`, 10, 15 * 60_000) || !rateLimit(`login:${email}`, 10, 15 * 60_000)) {
    return { error: 'Příliš mnoho pokusů. Zkuste to znovu za 15 minut.' }
  }
  const user = await prisma.user.findUnique({ where: { email } })
  // Ověřit heslo i u neexistujícího účtu, ať se podle času odpovědi nedá zjistit, který e-mail existuje.
  const ok = await verifyPassword(password, user?.passwordHash ?? (await dummyHash()))
  if (!user || !ok) return { error: 'Nesprávný e-mail nebo heslo.' }
  await createSession(user.id)
  redirect('/admin')
}

export async function logout() {
  await destroySession()
  redirect('/admin/prihlaseni')
}

// ───────────── nemovitosti ─────────────

const STATUSES: ListingStatus[] = ['DRAFT', 'ACTIVE', 'RESERVED', 'SOLD']
const OFFERS: OfferType[] = ['SALE', 'RENT']
const TYPES: PropertyType[] = ['HOUSE', 'FLAT', 'LAND', 'COMMERCIAL', 'COTTAGE', 'OTHER']

export async function createListing() {
  const user = await requireUser()
  const base = 'nova-nemovitost'
  let slug = base
  for (let i = 2; await prisma.listing.findUnique({ where: { slug } }); i++) slug = `${base}-${i}`
  const l = await prisma.listing.create({ data: { title: 'Nová nemovitost', slug, locality: '', agentId: user.id } })
  redirect(`/admin/nemovitosti/${l.id}`)
}

/** YouTube/Vimeo odkaz → adresa pro vložení (iframe). Jiné adresy nebereme. */
function embedUrl(raw: string) {
  if (!raw) return null
  try {
    const u = new URL(raw)
    const host = u.hostname.replace(/^www\.|^m\./, '')
    if (host === 'youtu.be') return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}`
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      const id = u.searchParams.get('v') ?? u.pathname.split('/').filter(Boolean).pop()
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null
    }
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const id = u.pathname.split('/').filter(Boolean).pop()
      return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : null
    }
  } catch {
    // neplatná adresa
  }
  return undefined
}

export async function saveListing(id: string, _: AdminState, fd: FormData): Promise<AdminState> {
  await requireUser()
  const current = await prisma.listing.findUnique({ where: { id }, select: { status: true, publishedAt: true, soldAt: true } })
  if (!current) return { error: 'Nemovitost neexistuje.' }

  const title = str(fd, 'title', 160)
  if (!title) return { error: 'Vyplňte název.' }
  const locality = str(fd, 'locality', 120)
  const status = STATUSES.find((s) => s === fd.get('status')) ?? 'DRAFT'
  if (status !== 'DRAFT' && !locality) return { error: 'Před zveřejněním vyplňte lokalitu.' }

  // Adresa: zadaná ručně, jinak z názvu a lokality. Zástupná „nova-nemovitost“ z konceptu se přegeneruje.
  const typed = str(fd, 'slug', 100)
  const baseSlug = slugify(!typed || /^nova-nemovitost(-\d+)?$/.test(typed) ? `${title} ${locality}` : typed) || 'nemovitost'
  let slug = baseSlug
  for (let i = 2; await prisma.listing.findFirst({ where: { slug, id: { not: id } }, select: { id: true } }); i++) slug = `${baseSlug}-${i}`

  const video = embedUrl(str(fd, 'videoUrl', 300))
  if (video === undefined) return { error: 'Odkaz na video musí být z YouTube nebo Vimea.' }

  const energy = str(fd, 'energyClass', 2)
  const labels = fd.getAll('paramLabel').map((v) => String(v).trim().slice(0, 60))
  const values = fd.getAll('paramValue').map((v) => String(v).trim().slice(0, 200))
  const params = labels.map((label, i) => ({ label, value: values[i] ?? '' })).filter((p) => p.label && p.value)
  const agentId = str(fd, 'agentId', 40)

  await prisma.listing.update({
    where: { id },
    data: {
      title,
      slug,
      status,
      offerType: OFFERS.find((o) => o === fd.get('offerType')) ?? 'SALE',
      propertyType: TYPES.find((t) => t === fd.get('propertyType')) ?? 'HOUSE',
      locality,
      mapQuery: str(fd, 'mapQuery', 160),
      price: int(fd, 'price'),
      priceNote: str(fd, 'priceNote', 160),
      usableArea: int(fd, 'usableArea'),
      landArea: int(fd, 'landArea'),
      disposition: str(fd, 'disposition', 30),
      energyClass: (ENERGY_CLASSES as readonly string[]).includes(energy) ? energy : null,
      perex: str(fd, 'perex', 400),
      description: str(fd, 'description', 20_000),
      params,
      videoUrl: video,
      featured: fd.get('featured') === 'on',
      agentId: agentId ? ((await prisma.user.findUnique({ where: { id: agentId }, select: { id: true } }))?.id ?? null) : null,
      // Datum zveřejnění při prvním zveřejnění, datum prodeje při označení „prodáno“.
      publishedAt: current.publishedAt ?? (status !== 'DRAFT' ? new Date() : null),
      soldAt: status === 'SOLD' ? (current.soldAt ?? new Date()) : null,
    },
  })
  revalidatePath('/', 'layout')
  return { ok: true, message: status === 'DRAFT' ? 'Uloženo jako koncept (na webu není vidět).' : 'Uloženo a zveřejněno.' }
}

export async function deleteListing(id: string) {
  await requireUser()
  await prisma.listing.delete({ where: { id } })
  await deleteListingMedia(id)
  revalidatePath('/', 'layout')
  redirect('/admin/nemovitosti')
}

export async function reorderImages(listingId: string, ids: string[]) {
  await requireUser()
  const imgs = await prisma.listingImage.findMany({ where: { listingId }, select: { id: true } })
  const own = new Set(imgs.map((i) => i.id))
  await prisma.$transaction(ids.filter((i) => own.has(i)).map((imgId, sort) => prisma.listingImage.update({ where: { id: imgId }, data: { sort } })))
  revalidatePath('/', 'layout')
}

export async function deleteImage(imageId: string) {
  await requireUser()
  const img = await prisma.listingImage.delete({ where: { id: imageId } }).catch(() => null)
  if (img) await deleteListingImageFiles(img.listingId, img.id, img.sizes)
  revalidatePath('/', 'layout')
}

export async function updateImageAlt(imageId: string, alt: string) {
  await requireUser()
  await prisma.listingImage.update({ where: { id: imageId }, data: { alt: alt.trim().slice(0, 200) } })
}

export async function deleteVideo(listingId: string) {
  await requireUser()
  const l = await prisma.listing.findUnique({ where: { id: listingId }, select: { videoPath: true } })
  if (l?.videoPath) {
    const abs = mediaPath(l.videoPath)
    if (abs) await rm(abs, { force: true })
  }
  await prisma.listing.update({ where: { id: listingId }, data: { videoPath: null } })
  revalidatePath('/', 'layout')
}

// ───────────── poptávky ─────────────

const LEAD_STATUSES: LeadStatus[] = ['NEW', 'IN_PROGRESS', 'DONE', 'SPAM']

export async function setLeadStatus(id: string, status: string) {
  await requireUser()
  const s = LEAD_STATUSES.find((x) => x === status)
  if (s) await prisma.lead.update({ where: { id }, data: { status: s } })
  revalidatePath('/admin', 'layout')
}

export async function saveLeadNote(id: string, note: string) {
  await requireUser()
  await prisma.lead.update({ where: { id }, data: { note: note.slice(0, 5000) } })
  revalidatePath('/admin', 'layout')
}

export async function deleteLead(id: string) {
  await requireUser()
  await prisma.lead.delete({ where: { id } }).catch(() => null)
  revalidatePath('/admin', 'layout')
}

// ───────────── profil ─────────────

export async function saveProfile(_: AdminState, fd: FormData): Promise<AdminState> {
  const user = await requireUser()
  const name = str(fd, 'name', 100)
  if (name.length < 3) return { error: 'Vyplňte jméno.' }
  const publicEmail = str(fd, 'publicEmail', 120).toLowerCase()
  if (publicEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(publicEmail)) return { error: 'E-mail nevypadá správně.' }
  await prisma.user.update({
    where: { id: user.id },
    data: { name, role: str(fd, 'role', 60), phone: str(fd, 'phone', 40), publicEmail, bio: str(fd, 'bio', 2000) },
  })
  revalidatePath('/', 'layout')
  return { ok: true, message: 'Profil uložen.' }
}

export async function changePassword(_: AdminState, fd: FormData): Promise<AdminState> {
  const user = await requireUser()
  const current = String(fd.get('current') ?? '')
  const next = String(fd.get('next') ?? '')
  if (!rateLimit(`pw:${user.id}`, 10, 15 * 60_000)) return { error: 'Příliš mnoho pokusů, zkuste to později.' }
  if (!(await verifyPassword(current, user.passwordHash))) return { error: 'Současné heslo nesouhlasí.' }
  if (next.length < 10) return { error: 'Nové heslo musí mít aspoň 10 znaků.' }
  if (next !== String(fd.get('again') ?? '')) return { error: 'Hesla se neshodují.' }
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next) } })
  // Odhlásit ostatní zařízení (aktuální relace zůstává).
  await prisma.session.deleteMany({ where: { userId: user.id } })
  await createSession(user.id)
  return { ok: true, message: 'Heslo změněno. Ostatní zařízení jsou odhlášená.' }
}
