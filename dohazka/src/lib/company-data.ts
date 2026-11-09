import 'server-only'
import { prisma } from '@/lib/prisma'
import { dateColumnToKey, parseDayKey } from '@/lib/date'
import { buildMonth } from '@/lib/month'

/**
 * Měsíce všech zaměstnanců JEDNÉ firmy. Jediné místo, odkud jdou data do přehledu i do exportu.
 * - `orgId` je v dotazu na členství; záznamy se čtou vnořeně pod ně, takže se k cizí firmě nedá dostat ani přes id.
 * - Jen role EMPLOYEE: účetní a správce nemají povinnost zapisovat, jejich `tracksFrom` je den založení
 *   a v seznamu mezer by trvale svítili.
 * - Neaktivní člen se bere jen když v období něco zapsal (jeho hodiny patří do mezd), a mezery se mu nehledají.
 */
export async function loadCompanyPeople(orgId: string, fromKey: string, toKey: string) {
  const rozsah = { gte: parseDayKey(fromKey), lte: parseDayKey(toKey) }
  const clenove = await prisma.membership.findMany({
    where: { orgId, role: 'EMPLOYEE', OR: [{ active: true }, { entries: { some: { day: rozsah } } }] },
    select: {
      id: true,
      active: true,
      tracksFrom: true,
      user: { select: { name: true } },
      entries: { where: { day: rozsah }, orderBy: [{ day: 'asc' }, { createdAt: 'asc' }] },
    },
  })
  return clenove
    .map((m) => ({
      membershipId: m.id,
      personName: m.user.name,
      active: m.active,
      trackGaps: m.active,
      month: buildMonth({
        fromKey,
        toKey,
        tracksFromKey: dateColumnToKey(m.tracksFrom),
        entries: m.entries.map((e) => ({
          id: e.id,
          dayKey: dateColumnToKey(e.day),
          kind: e.kind,
          hours: e.hours === null ? null : Number(e.hours),
          fromTime: e.fromTime,
          toTime: e.toTime,
          place: e.place,
          note: e.note,
        })),
      }),
    }))
    .sort((a, b) => a.personName.localeCompare(b.personName, 'cs'))
}
