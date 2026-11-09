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
 * Otevře období. Smí jen správce firmy (nebo super admin): `can` vrací super adminovi true na všechno,
 * takže samotné requireCan roli OWNER nezaručí a účetní by uzávěrku, kterou sám zamkl, mohl tiše obejít.
 */
export async function unlockPeriod(periodKey: string): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireCan('lockPeriod')
  if (ctx.role !== 'OWNER' && !ctx.isSuperAdmin) return { error: 'Měsíc smí otevřít jen správce firmy.' }
  if (!platnyKlic(periodKey)) return { error: 'Neplatné období.' }
  // deleteMany: neexistující uzávěrka není chyba a orgId z kontextu drží izolaci firem.
  await prisma.periodLock.deleteMany({ where: { orgId: ctx.org.id, periodKey } })
  obnov()
  return { ok: true }
}
