// Zdroj návštěvy pro vlastní počítadlo (bez serveru — kvůli testům).

const KNOWN: [RegExp, string][] = [
  [/(^|\.)google\./, 'Google'],
  [/(^|\.)seznam\.cz$|(^|\.)search\.seznam\.cz$|(^|\.)email\.seznam\.cz$/, 'Seznam'],
  [/(^|\.)bing\.com$|(^|\.)duckduckgo\.com$|(^|\.)yahoo\./, 'Ostatní vyhledávače'],
  [/(^|\.)sreality\.cz$/, 'Sreality'],
  [/(^|\.)bezrealitky\.cz$|(^|\.)idnes\.cz$|(^|\.)realitymix\.cz$|(^|\.)reality\.cz$|(^|\.)realingo\.cz$/, 'Realitní portály'],
  [/(^|\.)facebook\.com$|(^|\.)fb\.com$|(^|\.)fb\.me$|^l\.facebook\.com$|^m\.facebook\.com$/, 'Facebook'],
  [/(^|\.)instagram\.com$/, 'Instagram'],
  [/(^|\.)linkedin\.com$|^lnkd\.in$/, 'LinkedIn'],
  [/(^|\.)mapy\.cz$|(^|\.)mapy\.com$/, 'Mapy.cz'],
  [/(^|\.)chatgpt\.com$|(^|\.)openai\.com$|(^|\.)perplexity\.ai$|(^|\.)claude\.ai$|(^|\.)gemini\.google\.com$/, 'AI asistenti'],
]

/** Krátký popis zdroje: utm_source má přednost, pak doména, ze které člověk přišel. Vlastní web = null (není nová návštěva). */
export function classifySource(referrer: string, utmSource: string, ownHost: string): string | null {
  const utm = utmSource.trim().toLowerCase().slice(0, 40)
  if (utm) {
    for (const [re, name] of KNOWN) if (re.test(utm) || re.test(`${utm}.com`)) return name
    return `Kampaň: ${utm}`
  }
  if (!referrer) return 'Přímo / neznámý'
  let host: string
  try {
    host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return 'Přímo / neznámý'
  }
  const own = ownHost.toLowerCase().replace(/^www\./, '')
  if (host === own || host.endsWith(`.${own}`)) return null
  // Pracovní verze a budoucí ostrá doména se navzájem nepočítají jako cizí zdroj.
  if (/(^|\.)vasirm\.(cz|jede\.online)$/.test(host)) return null
  for (const [re, name] of KNOWN) if (re.test(host)) return name
  return host.slice(0, 60)
}
