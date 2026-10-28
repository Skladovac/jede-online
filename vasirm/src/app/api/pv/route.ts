import { createHash } from 'crypto'
import { prisma } from '@/lib/prisma'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { classifySource } from '@/lib/traffic'

export const dynamic = 'force-dynamic'

const BOT = /bot|crawl|spider|slurp|facebookexternalhit|preview|headless|lighthouse|curl|wget|python|node-fetch|monitor/i

/** Dnešní datum v českém čase (statistika po českých dnech). */
function today() {
  const d = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague' }).format(new Date())
  return new Date(`${d}T00:00:00Z`)
}

/**
 * Vlastní počítadlo návštěv (vzor: pokemon/api/pv). Bez cookies a bez třetích stran:
 * ukládá se jen denní součet zobrazení, zdroj první stránky návštěvy a anonymní otisk návštěvníka
 * (sha256 z dne, IP, prohlížeče a tajné soli — zpětně z něj nejde nic zjistit a druhý den je jiný).
 * Tělo: {"p": cesta, "r": document.referrer (jen u první stránky), "u": utm_source}
 */
export async function POST(req: Request) {
  const ua = req.headers.get('user-agent') ?? ''
  if (!ua || BOT.test(ua)) return new Response(null, { status: 204 })
  const ip = await clientIp()
  if (!rateLimit(`pv:${ip}`, 120, 60_000)) return new Response(null, { status: 204 })

  let body: { p?: unknown; r?: unknown; u?: unknown }
  try {
    body = JSON.parse((await req.text()).slice(0, 2000))
  } catch {
    return new Response(null, { status: 204 })
  }
  let path = String(body.p ?? '').trim().split(/[?#]/)[0].slice(0, 200)
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\') || /^\/(admin|api|import|media)(\/|$)/.test(path))
    return new Response(null, { status: 204 })
  try {
    path = decodeURIComponent(path).slice(0, 200)
  } catch {
    // ponechat zakódované
  }

  const day = today()
  const salt = process.env.ANALYTICS_SALT ?? process.env.DATABASE_URL ?? ''
  const hash = createHash('sha256').update(`${day.toISOString()}|${ip}|${ua}|${salt}`).digest('hex')
  const host = req.headers.get('host') ?? ''
  const source = typeof body.r === 'string' || typeof body.u === 'string' ? classifySource(String(body.r ?? ''), String(body.u ?? ''), host) : null

  await Promise.all([
    prisma.pageStat.upsert({
      where: { day_path: { day, path } },
      create: { day, path, views: 1 },
      update: { views: { increment: 1 } },
    }),
    prisma.visitorDay.createMany({ data: [{ day, hash }], skipDuplicates: true }),
    source &&
      prisma.sourceStat.upsert({
        where: { day_source: { day, source } },
        create: { day, source, visits: 1 },
        update: { visits: { increment: 1 } },
      }),
  ]).catch((err) => console.error('[pv]', err))
  return new Response(null, { status: 204 })
}
