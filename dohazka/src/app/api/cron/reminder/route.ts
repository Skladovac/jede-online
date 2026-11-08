import { NextResponse, type NextRequest } from 'next/server'
import { runReminder } from '@/lib/reminder'

export const dynamic = 'force-dynamic'

/**
 * Večerní připomínka. Systemd timer volá každou hodinu; pípne se jen těm, komu je právě ono okno
 * (pražský čas). ?force=1 = ruční test mimo čas.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  return NextResponse.json(await runReminder({ force: req.nextUrl.searchParams.get('force') === '1' }))
}
