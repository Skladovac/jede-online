import type { Locale } from '@/lib/i18n/config'

/** Vlajka jako SVG (emoji vlajky Windows nezobrazí, jen písmena „CZ“/„SK“). */
export function Flag({ locale, className = 'h-4 w-6' }: { locale: Locale; className?: string }) {
  if (locale === 'cs')
    return (
      <svg viewBox="0 0 30 20" className={`${className} rounded-sm shadow-sm`} aria-hidden>
        <rect width="30" height="10" fill="#fff" />
        <rect y="10" width="30" height="10" fill="#d7141a" />
        <path d="M0 0 15 10 0 20Z" fill="#11457e" />
      </svg>
    )
  if (locale === 'sk')
    return (
      <svg viewBox="0 0 30 20" className={`${className} rounded-sm shadow-sm`} aria-hidden>
        <rect width="30" height="20" fill="#ee1c25" />
        <rect width="30" height="13.33" fill="#0b4ea2" />
        <rect width="30" height="6.67" fill="#fff" />
        <path d="M6 4h7v6.5c0 2.6-1.8 4.3-3.5 5-1.7-.7-3.5-2.4-3.5-5Z" fill="#fff" />
        <path d="M6.6 4.6h5.8v5.9c0 2.2-1.4 3.6-2.9 4.3-1.5-.7-2.9-2.1-2.9-4.3Z" fill="#ee1c25" />
        <path d="M9.2 6h.6v1.3h1.2v.6H9.8v1h1.6v.6H9.8v2h-.6v-2H7.6v-.6h1.6v-1H8v-.6h1.2Z" fill="#fff" />
        <path d="M6.9 12.2c.5-.6 1-.8 1.5-.4.4-.6 1.3-.6 1.7 0 .5-.4 1-.2 1.5.4-.6 1.1-1.5 1.9-2.1 2.2-.6-.3-1.5-1.1-2.6-2.2Z" fill="#0b4ea2" />
      </svg>
    )
  return (
    <svg viewBox="0 0 60 40" className={`${className} rounded-sm shadow-sm`} aria-hidden>
      <rect width="60" height="40" fill="#012169" />
      <path d="M0 0 60 40M60 0 0 40" stroke="#fff" strokeWidth="8" />
      <path d="M0 0 60 40M60 0 0 40" stroke="#c8102e" strokeWidth="3" />
      <path d="M30 0v40M0 20h60" stroke="#fff" strokeWidth="12" />
      <path d="M30 0v40M0 20h60" stroke="#c8102e" strokeWidth="7" />
    </svg>
  )
}
