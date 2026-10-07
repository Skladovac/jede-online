/** Zadní strana karty (vlastní kresba) jako náhrada za chybějící logo sady. */
export function CardBack({ className = 'h-16' }: { className?: string }) {
  return (
    <svg viewBox="0 0 63 88" className={`${className} w-auto drop-shadow-sm`} role="img" aria-label="Zadní strana karty">
      <defs>
        <radialGradient id="cb-bg" cx="50%" cy="45%" r="70%">
          <stop offset="0" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#1e3a8a" />
        </radialGradient>
      </defs>
      <rect x="0.5" y="0.5" width="62" height="87" rx="4" fill="#facc15" />
      <rect x="3.5" y="3.5" width="56" height="81" rx="3" fill="url(#cb-bg)" />
      <ellipse cx="31.5" cy="44" rx="22" ry="30" fill="none" stroke="#93c5fd" strokeWidth="1" opacity="0.5" />
      <g transform="translate(31.5 44)">
        <circle r="13" fill="#f8fafc" stroke="#0f172a" strokeWidth="2" />
        <path d="M-13 0a13 13 0 0 1 26 0z" fill="#dc2626" stroke="#0f172a" strokeWidth="2" />
        <circle r="4.2" fill="#f8fafc" stroke="#0f172a" strokeWidth="2" />
      </g>
    </svg>
  )
}
