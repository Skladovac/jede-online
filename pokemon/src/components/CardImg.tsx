'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Obrázek karty do rámečku na výšku (63 : 88).
 * - Když se nenačte (katalog ho nemá), ukáže místo rozbitého obrázku název karty.
 * - Karty tištěné naležato (BREAK, LEGEND…) se poznají podle rozměrů obrázku a otočí o 90°, ať se neořežou.
 */
export function CardImg({ src, alt, className = '', eager = false }: { src: string | null; alt: string; className?: string; eager?: boolean }) {
  const [broken, setBroken] = useState(false)
  const [landscape, setLandscape] = useState(false)
  const ref = useRef<HTMLImageElement>(null)
  // Obrázek z mezipaměti se může načíst dřív, než React připojí onLoad — zkontrolovat i po připojení.
  useEffect(() => {
    const i = ref.current
    if (i?.complete && i.naturalWidth) setLandscape(i.naturalWidth > i.naturalHeight * 1.1)
  }, [src])
  if (!src || broken)
    return (
      <div className="grid h-full w-full place-items-center bg-gradient-to-br from-blue-700 to-blue-900 p-2 text-center text-xs font-semibold text-white">
        {alt}
      </div>
    )
  return (
    <span className="relative block h-full w-full overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={ref}
        src={src}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        onError={() => setBroken(true)}
        onLoad={(e) => setLandscape(e.currentTarget.naturalWidth > e.currentTarget.naturalHeight * 1.1)}
        className={
          landscape
            ? // Otočená: šířka obrázku = výška rámečku (88/63 šířky), výška obrázku = šířka rámečku (63/88 výšky).
              `absolute left-1/2 top-1/2 h-[71.59%] w-[139.68%] max-w-none -translate-x-1/2 -translate-y-1/2 rotate-90 object-cover ${className}`
            : `h-full w-full object-cover ${className}`
        }
      />
    </span>
  )
}
