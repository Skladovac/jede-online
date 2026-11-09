// Jméno stahovaného souboru a hlavička Content-Disposition. Čistý modul.

/** "Jan Novák" → "Jan-Novak" (jen ASCII, pro starší prohlížeče). */
const ascii = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

/** "Jan Novák" → "Jan-Novák" (zachová diakritiku, mezery a nebezpečné znaky nahradí pomlčkou). */
const unicode = (s: string) => s.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '')

/** Název nese firmu i člověka: kdo je ve dvou firmách, dostane za stejný měsíc dva různě pojmenované soubory. */
export function contentDisposition(personName: string, period: string, ext: string, orgName: string): string {
  const zaklad = (firma: string, jmeno: string) => `dohazka-${[firma, jmeno].filter(Boolean).join('-') || 'vykaz'}-${period}.${ext}`
  // `filename` je ASCII záloha, `filename*` nese skutečné jméno (RFC 5987).
  const plny = encodeURIComponent(zaklad(unicode(orgName), unicode(personName))).replace(/['()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())
  return `attachment; filename="${zaklad(ascii(orgName), ascii(personName))}"; filename*=UTF-8''${plny}`
}
