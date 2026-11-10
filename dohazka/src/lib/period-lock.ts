import { periodKeyForDay } from '@/lib/date'

// Bez server-only a bez Prisma záměrně: čistá funkce, kterou volají stránky i testy.
// Soubor s akcemi ('use server') ji exportovat nesmí, každý export by byl veřejný endpoint.

/** Hláška, kterou vrací všechny akce zápisu dne, když je období uzavřené. */
export const MESIC_UZAVREN = 'Měsíc je uzavřený, zápis už nejde změnit.'

/**
 * Je den `dayKey` v některém z uzavřených období? Období se určuje podle prvního dne období
 * firmy, takže při 16 patří 20. 11. do období 2026-12 (a zamkne ho uzávěrka prosince, ne listopadu).
 */
export function isLocked(lockedPeriods: string[], periodStartDay: number, dayKey: string): boolean {
  return lockedPeriods.includes(periodKeyForDay(periodStartDay, dayKey))
}
