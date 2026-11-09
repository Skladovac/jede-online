'use server'

import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireCan, requireOrgContext } from '@/lib/org'
import { dateColumnToKey, parseDayKey, periodKeyForDay } from '@/lib/date'
import { validateEntry } from '@/lib/entry'
import { MESIC_UZAVREN } from '@/lib/period-lock'

// Kontrola je tady, v akci, ne jen ve stránce: schovaný formulář nikoho nezastaví před přímým voláním akce.
// Platí pro všechny, i správce a super admina; kdo potřebuje zapsat, nejdřív období otevře.
// Čte se jen jedno období (klíč dne), ne celý seznam uzávěrek firmy. Neexportovat: v 'use server' souboru je export veřejný.
async function jeDenUzavreny(orgId: string, periodStartDay: number, dayKey: string): Promise<boolean> {
  const periodKey = periodKeyForDay(periodStartDay, dayKey)
  const zamek = await prisma.periodLock.findUnique({ where: { orgId_periodKey: { orgId, periodKey } }, select: { id: true } })
  return zamek !== null
}

// Po změně obnovíme obrazovku dne i měsíční přehled.
function obnovStranky(day: string) {
  revalidatePath(`/den/${day}`)
  revalidatePath('/mesic', 'layout')
}

// Pole formuláře, která validateEntry čte. Cokoli jiného z FormData ignorujeme.
const POLE = ['day', 'kind', 'hours', 'fromTime', 'toTime', 'place', 'note'] as const

export async function saveEntry(formData: FormData): Promise<{ error: string } | { ok: true }> {
  const ctx = await requireOrgContext()
  const vstup = Object.fromEntries(POLE.map((k) => [k, formData.get(k)]))
  const v = validateEntry(vstup)
  if (!v.ok) return { error: v.error }
  // „Nepracoval“ má vlastní akci, která smaže ostatní záznamy dne; jinak by vznikl den s DAYOFF i hodinami.
  if (v.value.kind === 'DAYOFF') return { error: 'Pro volný den použij tlačítko Nepracoval.' }
  const { day, ...zbytek } = v.value
  if (await jeDenUzavreny(ctx.org.id, ctx.org.periodStartDay, day)) return { error: MESIC_UZAVREN }
  const den = parseDayKey(day)
  // Místo patří jen k práci; u dovolené a nemoci by zůstalo „z minula“ a šlo by do výkazu.
  const data = { ...zbytek, place: zbytek.kind === 'WORK' ? zbytek.place : null, day: den, membershipId: ctx.membership.id }
  // Zápis dne přebije „Nepracoval“: DAYOFF toho dne se smaže ve stejné transakci, ať den neříká obojí.
  await prisma.$transaction([
    prisma.entry.deleteMany({ where: { membershipId: ctx.membership.id, day: den, kind: 'DAYOFF' } }),
    prisma.entry.create({ data }),
  ])
  obnovStranky(day)
  return { ok: true }
}

export async function deleteEntry(id: string): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireOrgContext()
  if (typeof id !== 'string' || !id) return { error: 'Smazání se nepodařilo.' }
  // Den záznamu je potřeba znát kvůli uzávěrce; hledá se vždy jen v aktivním členství, cizí id se tváří jako nenalezené.
  const zaznam = await prisma.entry.findFirst({ where: { id, membershipId: ctx.membership.id }, select: { day: true } })
  if (!zaznam) return { error: 'Smazání se nepodařilo.' }
  if (await jeDenUzavreny(ctx.org.id, ctx.org.periodStartDay, dateColumnToKey(zaznam.day))) return { error: MESIC_UZAVREN }
  // Mazání vždy jen vlastního záznamu aktivního členství: cizí id nic nesmaže.
  const smazano = await prisma.entry.deleteMany({ where: { id, membershipId: ctx.membership.id } })
  if (smazano.count === 0) return { error: 'Smazání se nepodařilo.' }
  revalidatePath('/den/[day]', 'page')
  revalidatePath('/mesic', 'layout')
  return { ok: true }
}

export async function markDayOff(day: string): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireOrgContext()
  const v = validateEntry({ day, kind: 'DAYOFF' })
  if (!v.ok) return { error: v.error }
  if (await jeDenUzavreny(ctx.org.id, ctx.org.periodStartDay, v.value.day)) return { error: MESIC_UZAVREN }
  const den = parseDayKey(v.value.day)
  // Jeden DAYOFF místo všeho ostatního; v transakci, aby den nezůstal prázdný nebo se dvěma záznamy.
  await prisma.$transaction([
    prisma.entry.deleteMany({ where: { membershipId: ctx.membership.id, day: den } }),
    prisma.entry.create({ data: { membershipId: ctx.membership.id, day: den, kind: 'DAYOFF', hours: null, fromTime: null, toTime: null, place: null, note: null } }),
  ])
  obnovStranky(v.value.day)
  return { ok: true }
}

// Do historie jdou jen pole záznamu, nikdy celý objekt z Prismy: Decimal se do JSON nevejde čistě,
// proto jsou hodiny číslo. Stejný tvar pro `before` i `after`, ať se dají porovnat.
type Snimek = { kind: string; hours: number | null; fromTime: string | null; toTime: string | null; place: string | null; note: string | null }
const snimek = (e: { kind: string; hours: unknown; fromTime: string | null; toTime: string | null; place: string | null; note: string | null }): Snimek => ({
  kind: e.kind,
  hours: e.hours === null || e.hours === undefined ? null : Number(e.hours),
  fromTime: e.fromTime,
  toTime: e.toTime,
  place: e.place,
  note: e.note,
})

// Pole `active` se tu záměrně nefiltruje: kdo z firmy odešel, má poslední měsíc, který je potřeba před mzdami
// srovnat, a ve firemním přehledu je vidět taky. Izolaci firem drží `orgId`.
// `membershipId` přichází z prohlížeče, proto se před jakýmkoli zápisem ověří, že patří do aktivní firmy;
// jinak by správce jedné firmy opravoval zápisy v cizí. Cizí id se tváří jako nenalezené.
async function clenFirmy(orgId: string, membershipId: unknown): Promise<boolean> {
  if (typeof membershipId !== 'string' || !membershipId) return false
  return (await prisma.membership.findFirst({ where: { id: membershipId, orgId }, select: { id: true } })) !== null
}

function obnovStrankyClena(membershipId: string, day: string) {
  revalidatePath(`/firma/vykazy/${membershipId}`)
  revalidatePath(`/firma/vykazy/${membershipId}/historie`)
  revalidatePath('/mesic', 'layout')
  revalidatePath(`/den/${day}`)
}

// Oprava cizího zápisu: totéž co saveEntry, ale pro jiné členství firmy a se záznamem do historie změn.
// Historie vzniká ve stejné transakci jako změna, takže po neúspěšném zápisu nezůstane osiřelý log.
export async function saveEntryFor(membershipId: string, formData: FormData): Promise<{ error: string } | { ok: true }> {
  const ctx = await requireCan('editOthersEntry')
  if (!(await clenFirmy(ctx.org.id, membershipId))) return { error: 'Zápis se nepodařilo uložit.' }
  const vstup = Object.fromEntries(POLE.map((k) => [k, formData.get(k)]))
  const v = validateEntry(vstup)
  if (!v.ok) return { error: v.error }
  if (v.value.kind === 'DAYOFF') return { error: 'Volný den zapisuje člověk sám tlačítkem Nepracoval.' }
  const { day, ...zbytek } = v.value
  // Správce není nad uzávěrkou: nejdřív období otevře.
  if (await jeDenUzavreny(ctx.org.id, ctx.org.periodStartDay, day)) return { error: MESIC_UZAVREN }
  const den = parseDayKey(day)
  const data = { ...zbytek, place: zbytek.kind === 'WORK' ? zbytek.place : null, day: den, membershipId }
  // Zápis dne přebije „Nepracoval“; kdo o volný den přijde, musí být v historii vidět taky.
  // Předčtení je uvnitř transakce se smazáním, jinak by DAYOFF vzniklý mezi nimi zmizel bez řádku v historii.
  const zmenil = { membershipId, dayKey: day, changedById: ctx.user.id }
  await prisma.$transaction(async (tx) => {
    // Postgres jede v READ COMMITTED, takze DAYOFF, ktery stihne vzniknout mezi tim ctenim a mazanim,
    // se smaze bez radku v historii. NEOPRAVOVAT to mazanim podle prectenych id: takovy DAYOFF by pak
    // u dne zustal spolu s novym zaznamem a den by rikal 'nepracoval' i 'osm hodin' zaroven, coz je
    // videt ve vykazu pro mzdy. Uzavrit to poradne by znamenalo prepnout VSECHNY zapisy dne na
    // Serializable (SSI plati, jen kdyz jsou serializable obe strany). Okno je milisekundy a vyzaduje,
    // aby zamestnanec zmackl Nepracoval presne ve chvili opravy; vedome prijato.
    const volno = await tx.entry.findMany({ where: { membershipId, day: den, kind: 'DAYOFF' } })
    await tx.entry.deleteMany({ where: { membershipId, day: den, kind: 'DAYOFF' } })
    await tx.entry.create({ data })
    for (const e of volno) await tx.entryChangeLog.create({ data: { ...zmenil, before: snimek(e), after: Prisma.DbNull } })
    await tx.entryChangeLog.create({ data: { ...zmenil, before: Prisma.DbNull, after: snimek(data) } })
  })
  obnovStrankyClena(membershipId, day)
  return { ok: true }
}

const NEUSPECH_SMAZANI = 'Smazání se nepodařilo.'

export async function deleteEntryFor(membershipId: string, id: string): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireCan('editOthersEntry')
  if (typeof id !== 'string' || !id) return { error: NEUSPECH_SMAZANI }
  if (!(await clenFirmy(ctx.org.id, membershipId))) return { error: NEUSPECH_SMAZANI }
  // Jen pole snímku a den: nový sloupec v Entry se tak nedostane do auditního JSONu.
  const zaznam = await prisma.entry.findFirst({
    where: { id, membershipId },
    select: { day: true, kind: true, hours: true, fromTime: true, toTime: true, place: true, note: true },
  })
  if (!zaznam) return { error: NEUSPECH_SMAZANI }
  const dayKey = dateColumnToKey(zaznam.day)
  if (await jeDenUzavreny(ctx.org.id, ctx.org.periodStartDay, dayKey)) return { error: MESIC_UZAVREN }
  // Smazání a log v jedné transakci; když mezitím záznam zmizel (count 0), log se nezapíše a vrací se chyba.
  const NENALEZENO = new Error('nenalezeno')
  try {
    await prisma.$transaction(async (tx) => {
      const smazano = await tx.entry.deleteMany({ where: { id, membershipId } })
      if (smazano.count === 0) throw NENALEZENO
      await tx.entryChangeLog.create({ data: { membershipId, dayKey, changedById: ctx.user.id, before: snimek(zaznam), after: Prisma.DbNull } })
    })
  } catch (e) {
    if (e === NENALEZENO) return { error: NEUSPECH_SMAZANI }
    throw e
  }
  obnovStrankyClena(membershipId, dayKey)
  return { ok: true }
}
