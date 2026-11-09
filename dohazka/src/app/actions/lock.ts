'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireCan } from '@/lib/org'
import { parsePeriod } from '@/lib/date'

// Tenhle soubor smí exportovat jen serverové akce: každý export je volatelný z prohlížeče.

// Klíč z prohlížeče se nikdy nebere jako hotový: jen tvar RRRR-MM s rokem 2000–2100.
function platnyKlic(periodKey: unknown): periodKey is string {
  return typeof periodKey === 'string' && parsePeriod(periodKey) !== null
}

function obnov() {
  revalidatePath('/firma/vykazy', 'layout')
  revalidatePath('/den/[day]', 'page')
  revalidatePath('/mesic', 'layout')
}

/** Uzavře období aktivní firmy. Opakované uzavření je v pořádku (už zamčeno = hotovo), nesmí spadnout na 500. */
export async function lockPeriod(periodKey: string): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireCan('lockPeriod')
  if (!platnyKlic(periodKey)) return { error: 'Neplatné období.' }
  // upsert s prázdným update: druhé zamčení (dvojklik, dva účetní) nechá původního zamykatele a datum.
  await prisma.periodLock.upsert({
    where: { orgId_periodKey: { orgId: ctx.org.id, periodKey } },
    create: { orgId: ctx.org.id, periodKey, lockedById: ctx.user.id },
    update: {},
  })
  obnov()
  return { ok: true }
}

/**
 * Otevře období. Vlastní akce matice (`unlockPeriod`), kterou má jen OWNER: účetní smí zamykat, ale ne
 * odemykat, jinak by uzávěrku, kterou sám zamkl, tiše obešel. Super adminovi `can` vrací true na všechno,
 * takže requireCan pokryje správce firmy i jeho a ruční podmínka na roli tu být nemusí.
 */
export async function unlockPeriod(periodKey: string): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireCan('unlockPeriod')
  if (!platnyKlic(periodKey)) return { error: 'Neplatné období.' }
  // deleteMany: neexistující uzávěrka není chyba a orgId z kontextu drží izolaci firem.
  await prisma.periodLock.deleteMany({ where: { orgId: ctx.org.id, periodKey } })
  obnov()
  return { ok: true }
}
