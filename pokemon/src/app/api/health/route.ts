import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * Smoke endpoint pro deploy. ZÁMĚRNĚ sahá do databáze a vrací GIT_COMMIT,
 * aby deploy skript poznal rozbité nebo staré nasazení. Při výpadku DB vrací 503.
 */
export async function GET() {
  const commit = process.env.GIT_COMMIT ?? 'unknown'

  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ status: 'ok', db: 'up', commit })
  } catch (err) {
    console.error('[health] DB check failed:', err)
    return NextResponse.json({ status: 'degraded', db: 'down', commit }, { status: 503 })
  }
}
