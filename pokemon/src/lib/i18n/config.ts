// Jazyky webu. Klíčem překladu je český text (čeština je výchozí); co v slovníku chybí, zůstane česky.
export const LOCALES = ['cs', 'sk', 'en'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'cs'
export const LOCALE_COOKIE = 'lang'

export const LOCALE_INFO: Record<Locale, { flag: string; label: string; htmlLang: string; intl: string }> = {
  cs: { flag: '🇨🇿', label: 'Čeština', htmlLang: 'cs', intl: 'cs-CZ' },
  sk: { flag: '🇸🇰', label: 'Slovenčina', htmlLang: 'sk', intl: 'sk-SK' },
  en: { flag: '🇬🇧', label: 'English', htmlLang: 'en', intl: 'en-GB' },
}

export const isLocale = (v: unknown): v is Locale => typeof v === 'string' && (LOCALES as readonly string[]).includes(v)

export type Dict = Record<string, string>
export type TFunc = (text: string, vars?: Record<string, string | number>) => string

/** Překlad s doplněním proměnných: t('Ahoj, {name}!', { name }) */
export function makeT(dict: Dict | null): TFunc {
  return (text, vars) => {
    let s = (dict && dict[text]) || text
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v))
    return s
  }
}
