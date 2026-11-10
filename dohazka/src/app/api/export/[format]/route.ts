import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOrgContext } from '@/lib/org'
import { parsePeriod, dateColumnToKey, parseDayKey, periodRange } from '@/lib/date'
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

/** GET /api/export/[format]?period=YYYY-MM — výkaz přihlášeného člena aktivní firmy. */
export async function GET(req: Request, { params }: { params: Promise<{ format: string }> }) {
  // Není tu žádný middleware, route je volatelná zvenčí — přihlášení si hlídáme sami.
  const ctx = await requireOrgContext()

  const { format } = await params
  if (!(FORMATY as readonly string[]).includes(format)) return chyba(400, 'Neznámý formát.')

  const period = new URL(req.url).searchParams.get('period') ?? ''
  const p = parsePeriod(period)
  if (!p) return chyba(400, 'Neplatné období, očekávám RRRR-MM.')

  const { fromKey, toKey } = periodRange(ctx.org.periodStartDay, p.year, p.month)
  // Vždy jen záznamy aktivního členství.
  const zapsane = await prisma.entry.findMany({
    where: { membershipId: ctx.membership.id, day: { gte: parseDayKey(fromKey), lte: parseDayKey(toKey) } },
    orderBy: [{ day: 'asc' }, { createdAt: 'asc' }],
  })

  const month = buildMonth({
    fromKey,
    toKey,
    // @db.Date přichází jako UTC půlnoc, proto UTC.
    tracksFromKey: dateColumnToKey(ctx.membership.tracksFrom),
    entries: zapsane.map((e) => ({
      id: e.id,
      dayKey: dateColumnToKey(e.day),
      kind: e.kind,
      hours: e.hours === null ? null : Number(e.hours),
      fromTime: e.fromTime,
      toTime: e.toTime,
      place: e.place,
      note: e.note,
    })),
  })
  const report = buildReport({ orgName: ctx.org.reportName, personName: ctx.user.name, fromKey, toKey, month })

  const hlavicky = {
    'Content-Disposition': contentDisposition(ctx.user.name, period, format, ctx.org.reportName),
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
