import { NextResponse, type NextRequest } from 'next/server'
import { runMatchDigest } from '@/lib/match-digest'

export const dynamic = 'force-dynamic'

/**
 * Denní e-mail o shodách („někdo nabízí, co ti chybí“). Spouští cron na serveru odpoledne (15:00 UTC):
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3400/api/cron/match-digest
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  return NextResponse.json(await runMatchDigest())
}
