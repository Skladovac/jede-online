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
import { enqueueSync } from '@/lib/realman-sync'
import { notifyAdmin } from '@/lib/email'
import { QUESTIONS, QUESTION_KEYS, readAnswers } from '@/lib/questionnaire'

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
  const current = await prisma.listing.findUnique({ where: { id }, select: { status: true, publishedAt: true, soldAt: true, source: true } })
  if (!current) return { error: 'Nemovitost neexistuje.' }
  if (current.source === 'REALMAN') return { error: 'Tahle nemovitost se upravuje v Realmanu.' }

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

/** Fotky a video nemovitostí z Realmanu spravuje Realman — tady se nesmí měnit. */
async function assertManual(listingId: string) {
  const l = await prisma.listing.findUnique({ where: { id: listingId }, select: { source: true } })
  if (!l || l.source === 'REALMAN') throw new Error('Nemovitost z Realmanu se upravuje v Realmanu.')
}

export async function reorderImages(listingId: string, ids: string[]) {
  await requireUser()
  await assertManual(listingId)
  const imgs = await prisma.listingImage.findMany({ where: { listingId }, select: { id: true } })
  const own = new Set(imgs.map((i) => i.id))
  await prisma.$transaction(ids.filter((i) => own.has(i)).map((imgId, sort) => prisma.listingImage.update({ where: { id: imgId }, data: { sort } })))
  revalidatePath('/', 'layout')
}

export async function deleteImage(imageId: string) {
  await requireUser()
  const owner = await prisma.listingImage.findUnique({ where: { id: imageId }, select: { listingId: true } })
  if (!owner) return
  await assertManual(owner.listingId)
  const img = await prisma.listingImage.delete({ where: { id: imageId } }).catch(() => null)
  if (img) await deleteListingImageFiles(img.listingId, img.id, img.sizes)
  revalidatePath('/', 'layout')
}

export async function updateImageAlt(imageId: string, alt: string) {
  await requireUser()
  const owner = await prisma.listingImage.findUnique({ where: { id: imageId }, select: { listingId: true } })
  if (!owner) return
  await assertManual(owner.listingId)
  await prisma.listingImage.update({ where: { id: imageId }, data: { alt: alt.trim().slice(0, 200) } })
}

export async function deleteVideo(listingId: string) {
  await requireUser()
  await assertManual(listingId)
  const l = await prisma.listing.findUnique({ where: { id: listingId }, select: { videoPath: true } })
  if (l?.videoPath) {
    const abs = mediaPath(l.videoPath)
    if (abs) await rm(abs, { force: true })
  }
  await prisma.listing.update({ where: { id: listingId }, data: { videoPath: null } })
  revalidatePath('/', 'layout')
}

// ───────────── Realman ─────────────

/** U nemovitosti z Realmanu jde na webu měnit jen zvýraznění. */
export async function setFeatured(id: string, featured: boolean) {
  await requireUser()
  await prisma.listing.update({ where: { id }, data: { featured } })
  revalidatePath('/', 'layout')
}

/** Zkusit znovu stáhnout fotky / video (odkazy z Realmanu mohly mezitím vypršet — pak pomůže nový export). */
export async function retrySync(id: string) {
  await requireUser()
  const l = await prisma.listing.findUnique({ where: { id }, select: { source: true, syncPayload: true } })
  if (l?.source !== 'REALMAN' || !l.syncPayload) return
  await prisma.listing.update({ where: { id }, data: { syncState: 'pending', syncAttempts: 0, syncError: '' } })
  enqueueSync(id)
  revalidatePath('/admin', 'layout')
}

// ───────────── dotazník ─────────────

/** Uloží jednu odpověď (průběžně, při opuštění pole). */
export async function saveAnswer(key: string, value: string) {
  const user = await requireUser()
  if (!QUESTION_KEYS.has(key)) return { error: 'Neznámá otázka.' }
  const q = await prisma.questionnaire.findUnique({ where: { userId: user.id } })
  const answers = { ...readAnswers(q?.answers), [key]: String(value ?? '').slice(0, 6000) }
  await prisma.questionnaire.upsert({ where: { userId: user.id }, create: { userId: user.id, answers }, update: { answers } })
  return { ok: true }
}

/** Odeslání: označí dotazník jako hotový a pošle odpovědi e-mailem správci webu. */
export async function submitQuestionnaire(answersFromForm: Record<string, string>) {
  const user = await requireUser()
  const clean: Record<string, string> = {}
  for (const [k, v] of Object.entries(answersFromForm ?? {})) if (QUESTION_KEYS.has(k) && typeof v === 'string') clean[k] = v.slice(0, 6000)
  const q = await prisma.questionnaire.findUnique({ where: { userId: user.id } })
  const answers = { ...readAnswers(q?.answers), ...clean }
  await prisma.questionnaire.upsert({
    where: { userId: user.id },
    create: { userId: user.id, answers, submittedAt: new Date() },
    update: { answers, submittedAt: new Date() },
  })
  await notifyAdmin({
    subject: `Dotazník vyplněn: ${user.name}`,
    rows: QUESTIONS.filter((x) => (answers[x.key] ?? '').trim()).map((x) => [x.label, answers[x.key]] as [string, string]),
    adminPath: '/admin/dotaznik',
  })
  revalidatePath('/admin', 'layout')
  return { ok: true }
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
  const video = embedUrl(str(fd, 'videoUrl', 300))
  if (video === undefined) return { error: 'Odkaz na video musí být z YouTube nebo Vimea.' }
  const specialties = str(fd, 'specialties', 400)
    .split(',')
    .map((s) => s.trim().slice(0, 40))
    .filter(Boolean)
    .slice(0, 8)
  await prisma.user.update({
    where: { id: user.id },
    data: {
      name,
      role: str(fd, 'role', 60),
      phone: str(fd, 'phone', 40),
      publicEmail,
      bio: str(fd, 'bio', 600),
      story: str(fd, 'story', 8000),
      specialties,
      yearsInField: int(fd, 'yearsInField'),
      soldCount: int(fd, 'soldCount'),
      avgSaleDays: int(fd, 'avgSaleDays'),
      videoUrl: video,
    },
  })
  revalidatePath('/', 'layout')
  return { ok: true, message: 'Profil uložen.' }
}

// ───────────── tým a reference ─────────────

export async function saveTeam(_: AdminState, fd: FormData): Promise<AdminState> {
  await requireUser()
  const data = { yearsInField: int(fd, 'yearsInField'), soldCount: int(fd, 'soldCount'), avgSaleDays: int(fd, 'avgSaleDays'), story: str(fd, 'story', 8000) }
  await prisma.teamSettings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data })
  revalidatePath('/', 'layout')
  return { ok: true, message: 'Uloženo.' }
}

export async function saveTestimonial(id: string | null, _: AdminState, fd: FormData): Promise<AdminState> {
  await requireUser()
  const quote = str(fd, 'quote', 1200)
  const clientName = str(fd, 'clientName', 60)
  if (quote.length < 10) return { error: 'Vyplňte text reference.' }
  if (!clientName) return { error: 'Vyplňte jméno klienta (stačí „Jana K.“).' }
  const consent = fd.get('consent') === 'on'
  const published = fd.get('published') === 'on'
  if (published && !consent) return { error: 'Zveřejnit jde jen referenci, ke které má klient souhlas.' }
  const agentId = str(fd, 'agentId', 40)
  const listingId = str(fd, 'listingId', 40)
  const data = {
    quote,
    clientName,
    clientPlace: str(fd, 'clientPlace', 60),
    propertyLabel: str(fd, 'propertyLabel', 80),
    agentId: agentId ? ((await prisma.user.findUnique({ where: { id: agentId }, select: { id: true } }))?.id ?? null) : null,
    listingId: listingId ? ((await prisma.listing.findUnique({ where: { id: listingId }, select: { id: true } }))?.id ?? null) : null,
    consent,
    published,
    sort: int(fd, 'sort') ?? 0,
  }
  if (id) await prisma.testimonial.update({ where: { id }, data })
  else await prisma.testimonial.create({ data })
  revalidatePath('/', 'layout')
  if (!id) redirect('/admin/reference')
  return { ok: true, message: published ? 'Uloženo a zveřejněno.' : 'Uloženo (na webu zatím není).' }
}

export async function deleteTestimonial(id: string) {
  await requireUser()
  await prisma.testimonial.delete({ where: { id } }).catch(() => null)
  revalidatePath('/', 'layout')
  redirect('/admin/reference')
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
