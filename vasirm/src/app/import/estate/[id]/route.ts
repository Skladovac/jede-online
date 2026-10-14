import { timingSafeEqual } from 'crypto'
import { after } from 'next/server'
import { clientIp } from '@/lib/rate-limit'
import { RealmanError, enqueueSync, logRealman, markWithdrawn, startSweeper, upsertFromRealman } from '@/lib/realman-sync'
import { SITE_URL } from '@/lib/site'

// Export z Realmanu („Dokumentace exportu na externí web klienta“, REST v3):
//   POST   /import/estate/{ID}  — nová / upravená nabídka (JSON: estate, estate_readable, seller, photos, videos)
//   DELETE /import/estate/{ID}  — nabídka stažená z exportu → na webu „Prodáno“
// Ověření: hlavička `apikey` (REALMAN_API_KEY) + IP adresy Realmanu 88.86.117.161–173.
// Odpověď: {"message", "url", "external_id"}; 200 OK, 404 chyba v datech, 500 chyba systému.

export const dynamic = 'force-dynamic'

const MAX_BODY = 5 * 1024 * 1024

function realmanIp(ip: string) {
  if (process.env.REALMAN_ALLOW_ANY_IP === '1') return true
  const m = ip.match(/^88\.86\.117\.(\d{1,3})$/)
  return !!m && Number(m[1]) >= 161 && Number(m[1]) <= 173
}

function keyOk(given: string | null) {
  const key = process.env.REALMAN_API_KEY ?? ''
  if (key.length < 32 || !given) return false
  const a = Buffer.from(given)
  const b = Buffer.from(key)
  return a.length === b.length && timingSafeEqual(a, b)
}

const json = (status: number, message: string, extra: { url?: string; external_id?: string } = {}) =>
  Response.json({ message, url: extra.url ?? '', external_id: extra.external_id ?? '' }, { status })

/** Společné kontroly; vrací chybovou odpověď, nebo null. */
async function guard(req: Request, id: string, method: string) {
  const ip = await clientIp()
  if (!realmanIp(ip) || !keyOk(req.headers.get('apikey'))) {
    await logRealman({ externalId: id, method, ok: false, message: `Odmítnuto (IP ${ip} nebo neplatný apikey)`, ip })
    return { error: json(403, 'Neoprávněný přístup.'), ip }
  }
  if (!/^\d{1,15}$/.test(id)) {
    await logRealman({ externalId: id, method, ok: false, message: 'Neplatné ID nabídky', ip })
    return { error: json(404, 'Neplatné ID nabídky.'), ip }
  }
  return { error: null, ip }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { error, ip } = await guard(req, id, 'POST')
  if (error) return error
  startSweeper()

  let payload: unknown
  try {
    const text = await req.text()
    if (text.length > MAX_BODY) throw new RealmanError('Data jsou příliš velká.')
    payload = JSON.parse(text)
  } catch (e) {
    const message = e instanceof RealmanError ? e.message : 'Neplatná data (očekáváme JSON).'
    await logRealman({ externalId: id, method: 'POST', ok: false, message, ip })
    return json(404, message)
  }

  try {
    const listing = await upsertFromRealman(id, payload)
    const url = `${SITE_URL}/nabidka/${listing.slug}`
    await logRealman({ externalId: id, method: 'POST', ok: true, message: `Uloženo: ${listing.title}`, listingId: listing.id, ip })
    // Fotky a video až po odpovědi — Realman nemusí čekat na stažení a zmenšení.
    after(() => enqueueSync(listing.id))
    return json(200, 'Nabídka uložena, fotografie se načítají.', { url, external_id: listing.id })
  } catch (e) {
    if (e instanceof RealmanError) {
      await logRealman({ externalId: id, method: 'POST', ok: false, message: e.message, ip })
      return json(404, e.message)
    }
    console.error('[realman] POST', id, e)
    await logRealman({ externalId: id, method: 'POST', ok: false, message: 'Systémová chyba při ukládání', ip })
    return json(500, 'Systémová chyba při ukládání nabídky.')
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { error, ip } = await guard(req, id, 'DELETE')
  if (error) return error
  try {
    const listing = await markWithdrawn(id)
    if (!listing) {
      await logRealman({ externalId: id, method: 'DELETE', ok: true, message: 'Nabídka na webu není — nic k odstranění', ip })
      return json(200, 'Nabídka na webu není.')
    }
    await logRealman({ externalId: id, method: 'DELETE', ok: true, message: `Prodáno: ${listing.title}`, listingId: listing.id, ip })
    return json(200, 'Nabídka na webu označena jako prodaná.', { url: `${SITE_URL}/nabidka/${listing.slug}`, external_id: listing.id })
  } catch (e) {
    console.error('[realman] DELETE', id, e)
    await logRealman({ externalId: id, method: 'DELETE', ok: false, message: 'Systémová chyba', ip })
    return json(500, 'Systémová chyba.')
  }
}
