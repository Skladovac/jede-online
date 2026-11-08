import { NextResponse, type NextRequest } from 'next/server'
import { runWelcomeBackfill } from '@/lib/welcome-email'

export const dynamic = 'force-dynamic'

/**
 * Uvítací e-mail pro stávající ověřené uživatele, kteří ho ještě nedostali (jednorázově, ruční spuštění):
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" "http://127.0.0.1:3400/api/cron/welcome?limit=200"
 * Noví uživatelé ho dostávají automaticky hned po ověření e-mailu.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const limit = Math.min(500, Math.max(1, Number(req.nextUrl.searchParams.get('limit')) || 200))
  return NextResponse.json(await runWelcomeBackfill(limit))
}
