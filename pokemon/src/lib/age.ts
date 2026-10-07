// Věková hranice pro souhlas se zpracováním osobních údajů (GDPR čl. 8):
// Česko 15 let (zákon č. 110/2019 Sb.), Slovensko 16 let.
export const CONSENT_AGE = { CZ: 15, SK: 16 } as const
export type CountryCode = keyof typeof CONSENT_AGE

/** Věk v celých letech; známe jen rok a měsíc, takže měsíc narození bereme jako dovršený až po jeho skončení. */
export function ageAt(birthYear: number, birthMonth: number, now = new Date()) {
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  return y - birthYear - (m <= birthMonth ? 1 : 0)
}

export function needsParentConsent(birthYear: number, birthMonth: number, country: CountryCode, now = new Date()) {
  return ageAt(birthYear, birthMonth, now) < CONSENT_AGE[country]
}
