import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'
import { parseDayKey, periodRange } from '@/lib/date'
import { buildMonth } from '@/lib/month'
import { buildReport } from '@/lib/export/rows'
import { toCsv } from '@/lib/export/csv'
import { toXlsx } from '@/lib/export/xlsx'
import { toPdf } from '@/lib/export/pdf'
import { contentDisposition } from '@/lib/export/filename'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs' // exceljs i pdfkit potřebují Node

const FORMATY = ['csv', 'xlsx', 'pdf'] as const

const chyba = (status: number, zprava: string) => NextResponse.json({ error: zprava }, { status })

/** GET /api/export/[format]?period=YYYY-MM — výkaz přihlášeného uživatele. */
export async function GET(req: Request, { params }: { params: Promise<{ format: string }> }) {
  // Není tu žádný middleware, route je volatelná zvenčí — přihlášení si hlídáme sami.
  const user = await requireUser()

  const { format } = await params
  if (!(FORMATY as readonly string[]).includes(format)) return chyba(400, 'Neznámý formát.')

  const period = new URL(req.url).searchParams.get('period') ?? ''
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(period)
  if (!m) return chyba(400, 'Neplatné období, očekávám RRRR-MM.')

  const { fromKey, toKey } = periodRange(user.periodStartDay, Number(m[1]), Number(m[2]))
  // Vždy jen záznamy přihlášeného uživatele.
  const zapsane = await prisma.entry.findMany({
    where: { userId: user.id, day: { gte: parseDayKey(fromKey), lte: parseDayKey(toKey) } },
    orderBy: [{ day: 'asc' }, { createdAt: 'asc' }],
  })

  const month = buildMonth({
    fromKey,
    toKey,
    // @db.Date přichází jako UTC půlnoc, proto UTC.
    tracksFromKey: user.tracksFrom.toISOString().slice(0, 10),
    entries: zapsane.map((e) => ({
      id: e.id,
      dayKey: e.day.toISOString().slice(0, 10),
      kind: e.kind,
      hours: e.hours === null ? null : Number(e.hours),
      fromTime: e.fromTime,
      toTime: e.toTime,
      place: e.place,
      note: e.note,
    })),
  })
  const report = buildReport({ personName: user.name, fromKey, toKey, month })

  const hlavicky = {
    'Content-Disposition': contentDisposition(user.name, period, format),
    'Cache-Control': 'private, no-store',
  }
  if (format === 'csv') {
    return new NextResponse(toCsv(report), { headers: { ...hlavicky, 'Content-Type': 'text/csv; charset=utf-8' } })
  }
  if (format === 'pdf') {
    const pdf = await toPdf(report)
    return new NextResponse(new Uint8Array(pdf), { headers: { ...hlavicky, 'Content-Type': 'application/pdf' } })
  }
  const buf = await toXlsx(report)
  return new NextResponse(new Uint8Array(buf), {
    headers: { ...hlavicky, 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  })
}
