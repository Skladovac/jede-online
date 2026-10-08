import 'server-only'
import { cookies, headers } from 'next/headers'
import { cache } from 'react'
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, makeT, type Locale } from './config'
import { dictFor } from './dicts'

/** Jazyk návštěvníka: volba z vlaječky (cookie), jinak podle prohlížeče (sk → slovensky, cs → česky, jiné → anglicky). */
export const getLocale = cache(async (): Promise<Locale> => {
  const c = (await cookies()).get(LOCALE_COOKIE)?.value
  if (isLocale(c)) return c
  const al = ((await headers()).get('accept-language') ?? '').toLowerCase()
  const first = al.split(',').map((x) => x.trim().slice(0, 2))
  for (const l of first) {
    if (l === 'cs') return 'cs'
    if (l === 'sk') return 'sk'
    if (l === 'en') return 'en'
  }
  return DEFAULT_LOCALE
})

/** Překladová funkce pro serverové komponenty a akce: const t = await getT() */
export async function getT() {
  return makeT(dictFor(await getLocale()))
}

/** Překlad pro konkrétní jazyk (e-maily příjemci v jeho jazyce). */
export const tFor = (l: string | null | undefined) => makeT(dictFor(isLocale(l) ? l : DEFAULT_LOCALE))
