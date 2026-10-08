'use client'

import { createContext, useContext, useMemo } from 'react'
import { DEFAULT_LOCALE, makeT, type Dict, type Locale } from './config'

const Ctx = createContext<{ locale: Locale; dict: Dict | null }>({ locale: DEFAULT_LOCALE, dict: null })

/** Poskytne jazyk a slovník klientským komponentám (vkládá layout). */
export function I18nProvider({ locale, dict, children }: { locale: Locale; dict: Dict | null; children: React.ReactNode }) {
  return <Ctx.Provider value={{ locale, dict }}>{children}</Ctx.Provider>
}

export function useLocale() {
  return useContext(Ctx).locale
}

/** Překladová funkce v klientských komponentách: const t = useT() */
export function useT() {
  const { dict } = useContext(Ctx)
  return useMemo(() => makeT(dict), [dict])
}
