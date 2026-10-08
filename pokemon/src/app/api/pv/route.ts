import { NextResponse, type NextRequest } from 'next/server'
import { createHash } from 'crypto'
import { prisma } from '@/lib/prisma'
import { clientIp, rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const BOT = /bot|crawl|spider|slurp|facebookexternalhit|preview|headless|lighthouse|curl|wget|python|node-fetch/i

/** Dnešní datum v českém čase (statistika po českých dnech). */
function today() {
  const d = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague' }).format(new Date()) // YYYY-MM-DD
  return new Date(`${d}T00:00:00Z`)
}

/**
 * Počítadlo návštěv: prohlížeč pošle cestu stránky (bez parametrů). Ukládá se jen denní součet
 * a anonymní otisk návštěvníka (bez cookies, nic se nepředává třetím stranám).
 */
export async function POST(req: NextRequest) {
  const ua = req.headers.get('user-agent') ?? ''
  if (!ua || BOT.test(ua)) return new NextResponse(null, { status: 204 })
  const ip = await clientIp()
  if (!rateLimit(`pv:${ip}`, 120, 60_000)) return new NextResponse(null, { status: 204 })

  let path = (await req.text()).trim().split(/[?#]/)[0].slice(0, 200)
  if (!path.startsWith('/') || path.startsWith('/admin') || path.startsWith('/api')) return new NextResponse(null, { status: 204 })
  try {
    path = decodeURIComponent(path).slice(0, 200)
  } catch {
    // ponechat zakódované
  }
  const day = today()
  const hash = createHash('sha256')
    .update(`${day.toISOString()}|${ip}|${ua}|${process.env.CRON_SECRET ?? ''}`)
    .digest('hex')
  await Promise.all([
    prisma.pageStat.upsert({
      where: { day_path: { day, path } },
      create: { day, path, views: 1 },
      update: { views: { increment: 1 } },
    }),
    prisma.visitorDay.createMany({ data: [{ day, hash }], skipDuplicates: true }),
  ]).catch((err) => console.error('[pv]', err))
  return new NextResponse(null, { status: 204 })
}
