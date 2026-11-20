// Logo VRM je bílé PNG — barvíme ho přes CSS masku (barva = currentColor), takže funguje na tmavém i světlém.

export function LogoMark({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block bg-current ${className}`}
      style={{
        aspectRatio: '670 / 183',
        WebkitMask: 'url(/img/logo-mark.png) center / contain no-repeat',
        mask: 'url(/img/logo-mark.png) center / contain no-repeat',
      }}
    />
  )
}

export function LogoFull({ className = '' }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="VRM — Vaši realitní makléři"
      className={`inline-block bg-current ${className}`}
      style={{
        aspectRatio: '670 / 284',
        WebkitMask: 'url(/img/logo.png) center / contain no-repeat',
        mask: 'url(/img/logo.png) center / contain no-repeat',
      }}
    />
  )
}
