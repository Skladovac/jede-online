/**
 * Typy Pokémonů (energie) — barvy jen pro štítky typu, filtr a detaily karty, ne jako obecné barvy UI.
 * Klíč = název typu z katalogu TCGdex (anglicky), label = český text (klíč překladu).
 */
export const POKEMON_TYPES: Record<string, { label: string; color: string; text: string }> = {
  Grass: { label: 'Tráva', color: '#78C850', text: '#14310a' },
  Fire: { label: 'Oheň', color: '#F08030', text: '#3a1500' },
  Water: { label: 'Voda', color: '#6890F0', text: '#0b1d4a' },
  Lightning: { label: 'Elektřina', color: '#F8D030', text: '#3a2f00' },
  Psychic: { label: 'Psychika', color: '#F85888', text: '#45061b' },
  Fighting: { label: 'Boj', color: '#C03028', text: '#ffffff' },
  Darkness: { label: 'Temnota', color: '#705848', text: '#ffffff' },
  Metal: { label: 'Kov', color: '#B8B8D0', text: '#1f2133' },
  Fairy: { label: 'Víla', color: '#EE99AC', text: '#3d0d19' },
  Dragon: { label: 'Drak', color: '#7038F8', text: '#ffffff' },
  Colorless: { label: 'Bezbarvý', color: '#A8A878', text: '#24240f' },
}

export const typeInfo = (t: string) => POKEMON_TYPES[t] ?? null
