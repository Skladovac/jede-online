'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Loader2, Star, Trash2, Upload } from 'lucide-react'
import { deleteImage, reorderImages, updateImageAlt } from '@/app/actions/admin'
import { listingSrc } from '@/components/Photo'

type Img = { id: string; width: number; height: number; sizes: number[]; blur: string; alt: string }

/** Fotky nemovitosti: nahrání (víc najednou), pořadí přetažením nebo šipkami, hlavní fotka, smazání, popisek. */
export function ImageManager({ listingId, initial }: { listingId: string; initial: Img[] }) {
  const router = useRouter()
  const [images, setImages] = useState(initial)
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [drag, setDrag] = useState<number | null>(null)
  const [over, setOver] = useState(false)
  const [, startTransition] = useTransition()
  const input = useRef<HTMLInputElement>(null)

  const persist = (next: Img[]) => {
    setImages(next)
    startTransition(() => reorderImages(listingId, next.map((i) => i.id)))
  }

  const move = (from: number, to: number) => {
    if (to < 0 || to >= images.length || from === to) return
    const next = [...images]
    const [it] = next.splice(from, 1)
    next.splice(to, 0, it)
    persist(next)
  }

  async function upload(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'))
    if (!list.length) return
    setErrors([])
    setUploading({ done: 0, total: list.length })
    // Postupně po jedné — server je zmenšuje a malý server by souběh nedal.
    for (const [i, file] of list.entries()) {
      try {
        const res = await fetch(`/api/admin/upload?kind=image&listingId=${listingId}`, { method: 'POST', body: file, headers: { 'Content-Type': file.type } })
        const data = await res.json().catch(() => ({ error: 'Server neodpověděl.' }))
        if (!res.ok) throw new Error(data.error)
        setImages((prev) => [...prev, data.image])
      } catch (e) {
        setErrors((prev) => [...prev, `${file.name}: ${e instanceof Error ? e.message : 'nepovedlo se'}`])
      }
      setUploading({ done: i + 1, total: list.length })
    }
    setUploading(null)
    if (input.current) input.current.value = ''
    router.refresh()
  }

  return (
    <div className="mt-5">
      <div
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('Files')) {
            e.preventDefault()
            setOver(true)
          }
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          if (!e.dataTransfer.files.length) return
          e.preventDefault()
          setOver(false)
          upload(e.dataTransfer.files)
        }}
        className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed px-4 py-8 text-center transition ${over ? 'border-gold bg-gold/10' : 'border-ink/15'}`}
      >
        {uploading ? (
          <p className="flex items-center gap-2 font-semibold">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Nahrávám {uploading.done + 1 > uploading.total ? uploading.total : uploading.done + 1} z {uploading.total}…
          </p>
        ) : (
          <>
            <Upload className="h-7 w-7 text-gold-deep" aria-hidden />
            <p className="text-sm text-stone">Přetáhněte sem fotky, nebo</p>
            <button type="button" onClick={() => input.current?.click()} className="btn-ink min-h-[2.6rem]">
              Vybrat fotky
            </button>
            <p className="text-xs text-stone">JPG, PNG nebo WebP, max. 40 MB. Fotky se samy zmenší a odstraní se z nich údaje o poloze.</p>
          </>
        )}
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          hidden
          onChange={(e) => e.target.files && upload(e.target.files)}
        />
      </div>

      {errors.length > 0 && (
        <ul className="mt-3 space-y-1 border-l-2 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      {images.length > 0 && (
        <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((img, i) => (
            <li
              key={img.id}
              draggable
              onDragStart={() => setDrag(i)}
              onDragOver={(e) => drag != null && e.preventDefault()}
              onDrop={(e) => {
                if (drag == null) return
                e.preventDefault()
                move(drag, i)
                setDrag(null)
              }}
              onDragEnd={() => setDrag(null)}
              className={`group border bg-paper ${i === 0 ? 'border-gold' : 'border-ink/10'} ${drag === i ? 'opacity-40' : ''}`}
            >
              <div className="relative aspect-[4/3] cursor-grab overflow-hidden bg-paper-2 active:cursor-grabbing">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={listingSrc(listingId, img, 480)} alt="" className="h-full w-full object-cover" draggable={false} />
                {i === 0 && <span className="absolute left-2 top-2 bg-gold px-2 py-0.5 text-xs font-bold text-ink">Hlavní</span>}
                <span className="absolute right-2 top-2 bg-ink/70 px-1.5 text-xs tabular-nums text-paper">{i + 1}</span>
              </div>
              <div className="flex items-center gap-1 p-1.5">
                <IconBtn label="Posunout doleva" onClick={() => move(i, i - 1)} disabled={i === 0}>
                  <ChevronLeft className="h-4 w-4" />
                </IconBtn>
                <IconBtn label="Posunout doprava" onClick={() => move(i, i + 1)} disabled={i === images.length - 1}>
                  <ChevronRight className="h-4 w-4" />
                </IconBtn>
                <IconBtn label="Nastavit jako hlavní" onClick={() => move(i, 0)} disabled={i === 0}>
                  <Star className="h-4 w-4" />
                </IconBtn>
                <IconBtn
                  label="Smazat fotku"
                  danger
                  onClick={() => {
                    if (!confirm('Smazat tuto fotku?')) return
                    setImages((prev) => prev.filter((x) => x.id !== img.id))
                    startTransition(() => deleteImage(img.id))
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </IconBtn>
              </div>
              <input
                defaultValue={img.alt}
                onBlur={(e) => e.target.value !== img.alt && startTransition(() => updateImageAlt(img.id, e.target.value))}
                placeholder="Popisek fotky"
                aria-label={`Popisek fotky ${i + 1}`}
                className="w-full border-t border-ink/10 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-gold"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function IconBtn({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`grid h-8 flex-1 place-items-center text-stone transition hover:bg-paper-2 disabled:opacity-25 ${danger ? 'hover:text-red-600' : 'hover:text-ink'}`}
    >
      {children}
    </button>
  )
}
