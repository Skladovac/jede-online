'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireCan } from '@/lib/org'
import { parsePeriod } from '@/lib/date'
import { STARA_STRANKA } from '@/lib/stale-page'

// Tenhle soubor smí exportovat jen serverové akce: každý export je volatelný z prohlížeče.

// Obě akce berou `orgId` stránky, na které se kliklo. Bez toho by okno, které zůstalo na firmě A,
// zamklo nebo otevřelo měsíc firmy B — a uzávěrka je to, co firmě drží čísla pro mzdy.
// Proč se chybějící hodnota odmítá: viz komentář v '@/lib/stale-page'.

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
export async function lockPeriod(periodKey: string, orgId: string): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireCan('lockPeriod')
  if (orgId !== ctx.org.id) return { error: STARA_STRANKA }
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
export async function unlockPeriod(periodKey: string, orgId: string): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireCan('unlockPeriod')
  if (orgId !== ctx.org.id) return { error: STARA_STRANKA }
  if (!platnyKlic(periodKey)) return { error: 'Neplatné období.' }
  // deleteMany: neexistující uzávěrka není chyba a orgId z kontextu drží izolaci firem.
  await prisma.periodLock.deleteMany({ where: { orgId: ctx.org.id, periodKey } })
  obnov()
  return { ok: true }
}
