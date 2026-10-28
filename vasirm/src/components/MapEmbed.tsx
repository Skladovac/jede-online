'use client'

import { useState } from 'react'
import { MapPin } from 'lucide-react'

/**
 * Mapa Google až po kliknutí — bez kliknutí se k Googlu nic neposílá (žádné cookies třetích stran).
 * Ukazuje jen obec / část obce, ne přesnou adresu.
 */
export function MapEmbed({ query, label }: { query: string; label: string }) {
  const [show, setShow] = useState(false)
  const q = encodeURIComponent(query)
  if (show) {
    return (
      <iframe
        title={`Mapa: ${label}`}
        src={`https://maps.google.com/maps?q=${q}&z=13&output=embed`}
        className="aspect-[16/10] w-full border-0 bg-paper-3"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    )
  }
  return (
    <div className="module-grid relative grid aspect-[16/10] w-full place-items-center bg-paper-2 [background-size:3rem_3rem]">
      <div className="px-6 text-center">
        <MapPin className="mx-auto h-8 w-8 text-gold-deep" aria-hidden />
        <p className="mt-3 font-serif text-2xl">{label}</p>
        <button type="button" onClick={() => setShow(true)} className="btn-ink mt-5">
          Zobrazit mapu
        </button>
        <p className="mx-auto mt-3 max-w-xs text-xs text-stone">
          Mapa se načte ze služby Google. Nebo{' '}
          <a className="link-u" href={`https://www.google.com/maps/search/?api=1&query=${q}`} target="_blank" rel="noopener noreferrer">
            otevřete v Mapách Google
          </a>
          .
        </p>
      </div>
    </div>
  )
}
