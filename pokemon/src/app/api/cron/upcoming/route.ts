import { NextResponse, type NextRequest } from 'next/server'
import { runUpcomingSync } from '@/lib/upcoming'

export const dynamic = 'force-dynamic'

/**
 * Noční stažení připravovaných sad (po importu katalogu, aby se poznalo, které už vyšly).
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3400/api/cron/upcoming
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  return NextResponse.json(await runUpcomingSync())
}
