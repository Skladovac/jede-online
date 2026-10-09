import { NextResponse, type NextRequest } from 'next/server'
import { runFollowDigest } from '@/lib/social'

export const dynamic = 'force-dynamic'

/**
 * Denní souhrn nových nabídek sledovaných sběratelů do zvonečku.
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3400/api/cron/follow-digest
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  return NextResponse.json(await runFollowDigest())
}
