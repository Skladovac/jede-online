'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireOrgContext } from '@/lib/org'
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
