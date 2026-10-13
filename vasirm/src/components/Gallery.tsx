'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Grid2x2, X } from 'lucide-react'
import { ListingPhoto, listingSrc, listingSrcSet } from '@/components/Photo'

type Img = { id: string; width: number; height: number; sizes: number[]; blur: string; alt: string }

/** Mozaika fotek (1 velká + 4 menší) a prohlížeč přes celou obrazovku (šipky, Esc, swipe). */
export function Gallery({ listingId, images, title }: { listingId: string; images: Img[]; title: string }) {
  const [open, setOpen] = useState<number | null>(null)
  const total = images.length

  const go = useCallback((d: number) => setOpen((i) => (i == null ? i : (i + d + total) % total)), [total])

  useEffect(() => {
    if (open == null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null)
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [open, go])

  // Přednačíst sousední fotky, ať listování nečeká.
  useEffect(() => {
    if (open == null) return
    for (const d of [1, -1]) {
      const img = images[(open + d + total) % total]
      const pre = new Image()
      pre.src = listingSrc(listingId, img, 2400)
    }
  }, [open, images, listingId, total])

  const touch = useRef<number | null>(null)

  if (!total) return null
  const [main, ...rest] = images
  const side = rest.slice(0, 4)

  return (
    <>
      <div className="grid gap-2 md:grid-cols-4 md:grid-rows-2">
        <button
          type="button"
          onClick={() => setOpen(0)}
          className="group relative aspect-[4/3] overflow-hidden bg-paper-3 md:col-span-2 md:row-span-2 md:aspect-auto"
          aria-label={`Otevřít fotku 1 z ${total}`}
        >
          <ListingPhoto
            listingId={listingId}
            img={main}
            alt={title}
            sizes="(min-width: 768px) 50vw, 100vw"
            priority
            className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.02]"
          />
        </button>
        {side.map((img, i) => (
          <button
            key={img.id}
            type="button"
            onClick={() => setOpen(i + 1)}
            className="group relative hidden aspect-[4/3] overflow-hidden bg-paper-3 md:block"
            aria-label={`Otevřít fotku ${i + 2} z ${total}`}
          >
            <ListingPhoto
              listingId={listingId}
              img={img}
              alt={title}
              sizes="25vw"
              className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
            />
            {i === side.length - 1 && total > 5 && (
              <span className="absolute inset-0 grid place-items-center bg-ink/55 text-paper transition-colors group-hover:bg-ink/45">
                <span className="flex items-center gap-2 font-semibold">
                  <Grid2x2 className="h-4 w-4" aria-hidden /> +{total - 5} fotek
                </span>
              </span>
            )}
          </button>
        ))}
      </div>
      <button type="button" onClick={() => setOpen(0)} className="btn-ghost-dark mt-3 w-full md:hidden">
        <Grid2x2 className="h-4 w-4" aria-hidden /> Všech {total} fotek
      </button>

      {open != null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Fotogalerie: ${title}`}
          className="fixed inset-0 z-[100] flex flex-col bg-ink/[0.97] text-paper"
          onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touch.current == null) return
            const dx = e.changedTouches[0].clientX - touch.current
            if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1)
            touch.current = null
          }}
        >
          <div className="flex items-center justify-between px-4 py-3 sm:px-6">
            <p className="text-sm tabular-nums text-paper/70">
              {open + 1} / {total}
            </p>
            <button type="button" onClick={() => setOpen(null)} className="grid h-11 w-11 place-items-center hover:text-gold-light" aria-label="Zavřít galerii" autoFocus>
              <X className="h-6 w-6" />
            </button>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-16">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={images[open].id}
              src={listingSrc(listingId, images[open], 2400)}
              srcSet={listingSrcSet(listingId, images[open]).join(', ')}
              sizes="100vw"
              alt={images[open].alt || title}
              className="max-h-full max-w-full object-contain"
            />
            {total > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => go(-1)}
                  className="absolute left-2 top-1/2 hidden h-12 w-12 -translate-y-1/2 place-items-center border border-white/15 bg-ink/40 hover:border-gold hover:text-gold-light sm:grid"
                  aria-label="Předchozí fotka"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  type="button"
                  onClick={() => go(1)}
                  className="absolute right-2 top-1/2 hidden h-12 w-12 -translate-y-1/2 place-items-center border border-white/15 bg-ink/40 hover:border-gold hover:text-gold-light sm:grid"
                  aria-label="Další fotka"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            )}
          </div>
          <div className="flex gap-1.5 overflow-x-auto px-4 py-3 sm:justify-center">
            {images.map((img, i) => (
              <button
                key={img.id}
                type="button"
                onClick={() => setOpen(i)}
                className={`h-14 w-20 shrink-0 overflow-hidden border-2 transition ${i === open ? 'border-gold' : 'border-transparent opacity-50 hover:opacity-90'}`}
                aria-label={`Fotka ${i + 1}`}
                aria-current={i === open}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={listingSrc(listingId, img, 480)} alt="" loading="lazy" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
