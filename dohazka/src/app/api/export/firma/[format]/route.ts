import { NextResponse } from 'next/server'
import { requireCan } from '@/lib/org'
import { periodRange } from '@/lib/date'
import { loadCompanyPeople } from '@/lib/company-data'
import { buildCompanyReport } from '@/lib/company-report'
import { toCompanyCsv } from '@/lib/export/company-csv'
import { toCompanyXlsx } from '@/lib/export/company-xlsx'
import { contentDisposition } from '@/lib/export/filename'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs' // exceljs potřebuje Node

const chyba = (status: number, zprava: string) => NextResponse.json({ error: zprava }, { status })

/** GET /api/export/firma/[format]?period=YYYY-MM — výkaz všech zaměstnanců aktivní firmy. Jen csv a xlsx. */
export async function GET(req: Request, { params }: { params: Promise<{ format: string }> }) {
  // První příkaz: žádné parsování ani databáze před kontrolou oprávnění. Nebalit do try/catch (NEXT_REDIRECT).
  const ctx = await requireCan('exportCompany')

  const { format } = await params
  if (format === 'pdf') return chyba(400, 'Firemní export ve formátu PDF není k dispozici, použijte Excel nebo CSV.')
  if (format !== 'csv' && format !== 'xlsx') return chyba(400, 'Neznámý formát.')

  const period = new URL(req.url).searchParams.get('period') ?? ''
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(period)
  if (!m) return chyba(400, 'Neplatné období, očekávám RRRR-MM.')

  const { fromKey, toKey } = periodRange(ctx.org.periodStartDay, Number(m[1]), Number(m[2]))
  const people = await loadCompanyPeople(ctx.org.id, fromKey, toKey)
  const report = buildCompanyReport({ orgName: ctx.org.reportName, fromKey, toKey, people })

  const hlavicky = {
    'Content-Disposition': contentDisposition('', period, format, ctx.org.reportName),
    'Cache-Control': 'private, no-store',
  }
  if (format === 'csv') {
    return new NextResponse(toCompanyCsv(report), { headers: { ...hlavicky, 'Content-Type': 'text/csv; charset=utf-8' } })
  }
  const buf = await toCompanyXlsx(report)
  return new NextResponse(new Uint8Array(buf), {
    headers: { ...hlavicky, 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  })
}
