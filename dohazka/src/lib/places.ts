// Čistý modul (bez `server-only` a bez databáze), aby šel testovat přímo v Node.

/**
 * Nedávno použitá místa pro našeptávač: bez duplicit, nejčerstvější první.
 * Vstup nemusí být seřazený (řadí se podle `day` ve tvaru YYYY-MM-DD, který jde řadit jako text).
 * Prázdná a jen-mezerová místa se přeskakují, okolní mezery se ořezávají.
 */
export function recentPlaces(entries: { place: string | null; day: string }[], limit = 5): string[] {
  // Stabilní řazení od nejnovějšího dne; při stejném dni zůstává pořadí ze vstupu.
  const serazene = [...entries].sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0))
  if (limit <= 0) return []
  const videna = new Set<string>()
  for (const { place } of serazene) {
    const misto = place?.trim()
    if (!misto) continue
    videna.add(misto)
    if (videna.size >= limit) break
  }
  return [...videna]
}
