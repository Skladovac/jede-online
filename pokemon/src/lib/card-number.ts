/** Číslo karty v základní sadě (1–oficiální počet); secret rare a TG/GG/SV podsady mají číslo vyšší nebo s písmeny. */
export function isBaseCard(localId: string, officialCount: number) {
  return /^\d+$/.test(localId) && Number(localId) >= 1 && Number(localId) <= officialCount
}

/** Rozdělí karty sady na base set a „secret / mimo číslování“ (u sad bez oficiálního počtu je vše base). */
export function splitBase<T>(items: T[], localId: (t: T) => string, officialCount: number) {
  if (!officialCount) return { base: items, extra: [] as T[] }
  const base: T[] = []
  const extra: T[] = []
  for (const t of items) (isBaseCard(localId(t), officialCount) ? base : extra).push(t)
  return { base, extra }
}
