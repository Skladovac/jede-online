import { NextResponse, type NextRequest } from 'next/server'
import { syncCatalog, type SyncStats } from '@/lib/catalog-sync'
import { syncProducts } from '@/lib/product-sync'
import { snapshotAll } from '@/lib/portfolio'
import { syncJapanese } from '@/lib/catalog-sync-ja'

export const dynamic = 'force-dynamic'

/**
 * Noční import katalogu. Spouští cron na serveru:
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3400/api/cron/sync-catalog
 * Import trvá ~10 minut, proto běží na pozadí a odpověď je hned 202.
 * GET vrátí stav posledního běhu.
 */

let running: Promise<void> | null = null
let last: SyncStats | null = null

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  return !!secret && req.headers.get('authorization') === `Bearer ${secret}`
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (running) return NextResponse.json({ status: 'already-running' }, { status: 409 })

  // Jen japonské sady + obnova cen (ruční doplnění bez celého anglického importu).
  if (req.nextUrl.searchParams.get('only') === 'japonske') {
    running = syncJapanese()
      .then(() => syncProducts())
      .catch((err) => console.error('[ja] import selhal:', err))
      .finally(() => {
        running = null
      })
    return NextResponse.json({ status: 'started', only: 'japonske' }, { status: 202 })
  }

  if (req.nextUrl.searchParams.get('only') === 'produkty') {
    running = syncProducts()
      .catch((err) => console.error('[produkty] import selhal:', err))
      .finally(() => {
        running = null
      })
    return NextResponse.json({ status: 'started', only: 'produkty' }, { status: 202 })
  }

  running = syncCatalog()
    .then(async (s) => {
      last = s
      // Japonské sady (SV + Mega) — chyba nesmí shodit zbytek.
      await syncJapanese().catch((err) => console.error('[ja] import selhal:', err))
      // Zapečetěné produkty (Cardmarket) — chyba tady nesmí shodit import karet.
      await syncProducts().catch((err) => console.error('[produkty] import selhal:', err))
      // Denní snímek hodnoty sbírek až s čerstvými cenami.
      await snapshotAll().catch((err) => console.error('[portfolio] snímky selhaly:', err))
    })
    .catch((err) => {
      console.error('[catalog] import selhal:', err)
      last = { startedAt: new Date().toISOString(), sets: 0, cards: 0, cardDetailFailures: 0, setFailures: [], error: String(err) }
    })
    .finally(() => {
      running = null
    })

  return NextResponse.json({ status: 'started' }, { status: 202 })
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  return NextResponse.json({ running: !!running, last })
}
