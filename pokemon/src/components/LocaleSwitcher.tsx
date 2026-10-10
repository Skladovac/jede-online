'use client'

import { useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setLocale } from '@/app/actions/locale'
import { LOCALES, LOCALE_INFO } from '@/lib/i18n/config'
import { useLocale } from '@/lib/i18n/client'
import { Flag } from '@/components/Flag'

/** Vlaječka v liště: výběr jazyka (čeština, slovenčina, angličtina). */
export function LocaleSwitcher() {
  const locale = useLocale()
  const router = useRouter()
  const [pending, start] = useTransition()
  const ref = useRef<HTMLDetailsElement>(null)
  return (
    <details ref={ref} className="relative">
      <summary
        className="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-full hover:bg-white/10"
        aria-label={LOCALE_INFO[locale].label}
        title={LOCALE_INFO[locale].label}
      >
        {pending ? '…' : <Flag locale={locale} />}
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-44 overflow-hidden rounded-panel border border-line-strong bg-card py-1 text-sm text-fg shadow-lg">
        {LOCALES.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() =>
              start(async () => {
                if (ref.current) ref.current.open = false
                await setLocale(l)
                router.refresh()
              })
            }
            className={`flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left hover:bg-card-hover ${l === locale ? 'font-semibold' : ''}`}
          >
            <Flag locale={l} /> {LOCALE_INFO[l].label}
          </button>
        ))}
      </div>
    </details>
  )
}
