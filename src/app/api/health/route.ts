import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * Smoke endpoint pro deploy (pojistka 5 + 6 z INFRA-PODKLAD-Z-ELASRY.md).
 *
 * ZÁMĚRNĚ sahá do databáze — `/health`, který jen vrátí 200, už jednou lhal
 * o tom, že aplikace běží. `commit` se plní z GIT_COMMIT, aby verze nelhala.
 * Vrací 503, když DB neodpovídá, aby deploy skript poznal rozbité nasazení.
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
