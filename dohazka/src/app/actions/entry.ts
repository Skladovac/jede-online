'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireOrgContext } from '@/lib/org'
import { parseDayKey } from '@/lib/date'
import { validateEntry } from '@/lib/entry'

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

export async function deleteEntry(id: string): Promise<{ ok: boolean }> {
  const ctx = await requireOrgContext()
  if (typeof id !== 'string' || !id) return { ok: false }
  // Mazání vždy jen vlastního záznamu aktivního členství: cizí id nic nesmaže.
  const smazano = await prisma.entry.deleteMany({ where: { id, membershipId: ctx.membership.id } })
  if (smazano.count === 0) return { ok: false }
  revalidatePath('/den/[day]', 'page')
  revalidatePath('/mesic', 'layout')
  return { ok: true }
}

export async function markDayOff(day: string): Promise<{ ok: boolean }> {
  const ctx = await requireOrgContext()
  const v = validateEntry({ day, kind: 'DAYOFF' })
  if (!v.ok) return { ok: false }
  const den = parseDayKey(v.value.day)
  // Jeden DAYOFF místo všeho ostatního; v transakci, aby den nezůstal prázdný nebo se dvěma záznamy.
  await prisma.$transaction([
    prisma.entry.deleteMany({ where: { membershipId: ctx.membership.id, day: den } }),
    prisma.entry.create({ data: { membershipId: ctx.membership.id, day: den, kind: 'DAYOFF', hours: null, fromTime: null, toTime: null, place: null, note: null } }),
  ])
  obnovStranky(v.value.day)
  return { ok: true }
}
