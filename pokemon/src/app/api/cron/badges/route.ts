import { NextResponse, type NextRequest } from 'next/server'
import { refreshAllBadges } from '@/lib/badges'

export const dynamic = 'force-dynamic'

/**
 * Denní přepočet odznaků všech uživatelů (sbírky se mění průběžně; upozornění na nové odznaky pošle refreshBadges).
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3400/api/cron/badges
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  return NextResponse.json(await refreshAllBadges())
}
