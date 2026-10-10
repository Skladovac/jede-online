import 'server-only'
import { prisma } from '@/lib/prisma'

/** Focení karet je placené (OpenAI) a web je zdarma: 5 fotek denně na uživatele, den = pražský kalendářní den. */
export const PHOTO_DAILY = 5
/** Pojistka pro celý web za den (při náhlém návalu lidí). */
const PHOTO_DAILY_TOTAL = 500

/** Půlnoc dnešního dne v Praze (server běží v UTC). */
function pragueMidnight(now = new Date()) {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Prague', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).formatToParts(now)
  const n = (type: string) => Number(p.find((x) => x.type === type)?.value)
  const hour = n('hour') % 24 // některé prostředí vrací o půlnoci „24“
  return new Date(Math.floor(now.getTime() / 1000) * 1000 - ((hour * 60 + n('minute')) * 60 + n('second')) * 1000)
}

/** Kolik fotek dnes uživateli zbývá (admin bez limitu). */
export async function photosLeft(user: { id: string; isAdmin?: boolean }) {
  if (user.isAdmin) return Infinity
  const used = await prisma.photoScan.count({ where: { userId: user.id, createdAt: { gte: pragueMidnight() } } })
  return Math.max(0, PHOTO_DAILY - used)
}

/** Zapíše fotku do limitu. Vrací false, když už uživatel (nebo celý web) dnešní limit vyčerpal. */
export async function takePhotoSlot(user: { id: string; isAdmin?: boolean }) {
  const since = pragueMidnight()
  if (!user.isAdmin) {
    const [mine, total] = await Promise.all([
      prisma.photoScan.count({ where: { userId: user.id, createdAt: { gte: since } } }),
      prisma.photoScan.count({ where: { createdAt: { gte: since } } }),
    ])
    if (mine >= PHOTO_DAILY) return { ok: false as const, reason: 'user' as const }
    if (total >= PHOTO_DAILY_TOTAL) return { ok: false as const, reason: 'total' as const }
  }
  await prisma.photoScan.create({ data: { userId: user.id } })
  return { ok: true as const }
}
