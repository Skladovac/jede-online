'use client'

import { useEffect, useState } from 'react'
import { useT } from '@/lib/i18n/client'

const THEME_COOKIE = 'theme' // stejný název čte layout.tsx

/** Přepínač tmavý / světlý vzhled. Volba se uloží do cookie (server podle ní vykreslí stránku bez probliknutí). */
export function ThemeToggle({ variant = 'icon' }: { variant?: 'icon' | 'menu' | 'header' }) {
  const t = useT()
  const [dark, setDark] = useState(false)
  useEffect(() => setDark(document.documentElement.classList.contains('dark')), [])

  function toggle() {
    const next = !dark
    document.documentElement.classList.toggle('dark', next)
    document.cookie = `${THEME_COOKIE}=${next ? 'dark' : 'light'}; path=/; max-age=31536000; samesite=lax`
    setDark(next)
  }

  const label = dark ? t('Přepnout na světlý vzhled') : t('Přepnout na tmavý vzhled')
  if (variant === 'menu')
    return (
      <button type="button" onClick={toggle} className="block w-full px-4 py-2.5 text-left hover:bg-card-hover">
        {dark ? '☀️' : '🌙'} {dark ? t('Světlý vzhled') : t('Tmavý vzhled')}
      </button>
    )
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={`grid h-10 w-10 place-items-center rounded-full transition-colors duration-200 ${
        variant === 'header' ? 'text-white/90 hover:bg-white/10 hover:text-white' : 'text-muted hover:bg-card-hover hover:text-fg'
      }`}
    >
      {dark ? (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" strokeLinecap="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  )
}
