'use client'

import { useState } from 'react'

/** Obrázek karty; když se nenačte (katalog ho nemá), ukáže místo rozbitého obrázku název karty. */
export function CardImg({ src, alt }: { src: string | null; alt: string }) {
  const [broken, setBroken] = useState(false)
  if (!src || broken)
    return (
      <div className="grid h-full w-full place-items-center bg-gradient-to-br from-blue-700 to-blue-900 p-2 text-center text-xs font-semibold text-white">
        {alt}
      </div>
    )
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" onError={() => setBroken(true)} className="h-full w-full object-cover" />
}
