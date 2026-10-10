import { NextResponse, type NextRequest } from 'next/server'
import { runWeeklyDigest } from '@/lib/weekly-digest'

export const dynamic = 'force-dynamic'

/**
 * Týdenní souhrn e-mailem. Cron volá každou hodinu v neděli; odešle se jen v 17 h pražského času
 * (server je v UTC, letní/zimní čas řeší runWeeklyDigest). ?force=1 = ruční test mimo čas.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  return NextResponse.json(await runWeeklyDigest({ force: req.nextUrl.searchParams.get('force') === '1' }))
}
