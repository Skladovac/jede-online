'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n/client'

type Hit = { id: string; href: string; name: string; number: string; set: string; image: string | null; price: string | null }

export function SearchBox() {
  const router = useRouter()
  const t = useT()
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const boxRef = useRef<HTMLDivElement>(null)

  // Našeptávání s krátkou prodlevou, ať se neposílá dotaz na každé písmeno.
  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([])
      return
    }
    const ctrl = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/hledat?q=${encodeURIComponent(q.trim())}`, { signal: ctrl.signal })
        setHits(await res.json())
        setActive(-1)
        setOpen(true)
      } catch {
        /* zrušeno dalším psaním */
      }
    }, 200)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [q])

  useEffect(() => {
    const close = (e: MouseEvent) => !boxRef.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const go = (href: string) => {
    setOpen(false)
    setQ('')
    router.push(href)
  }

  return (
    <div ref={boxRef} className="relative w-full">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          if (active >= 0 && hits[active]) go(hits[active].href)
          else if (q.trim().length >= 2) go(`/hledat?q=${encodeURIComponent(q.trim())}`)
        }}
      >
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => hits.length && setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActive((a) => Math.min(a + 1, hits.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((a) => Math.max(a - 1, -1))
            } else if (e.key === 'Escape') setOpen(false)
          }}
          placeholder={t('Hledat: Charizard, SVI 045, Prismatic ETB…')}
          aria-label={t('Hledat kartu')}
          autoComplete="off"
          className="w-full rounded-full border border-slate-300 bg-white px-4 py-2 text-sm outline-none transition focus:border-yellow-500 focus:ring-2 focus:ring-yellow-400/40 dark:border-slate-700 dark:bg-slate-900"
        />
      </form>

      {open && q.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
          {hits.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500">{t('Nic jsme nenašli.')}</p>
          ) : (
            <ul>
              {hits.map((h, i) => (
                <li key={h.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(h.href)}
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left ${i === active ? 'bg-yellow-50 dark:bg-slate-800' : ''}`}
                  >
                    <span className="h-14 w-10 shrink-0 overflow-hidden rounded bg-slate-200 dark:bg-slate-800">
                      {h.image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={h.image} alt="" className="h-full w-full object-cover" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{h.name}</span>
                      <span className="block truncate text-xs text-slate-500">
                        {h.set} · {h.number}
                      </span>
                    </span>
                    {h.price && <span className="shrink-0 text-xs text-slate-500">≈ {h.price}</span>}
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => go(`/hledat?q=${encodeURIComponent(q.trim())}`)}
                  className="w-full border-t border-slate-200 px-4 py-2.5 text-left text-sm font-medium text-yellow-700 dark:border-slate-700 dark:text-yellow-400"
                >
                  {t('Všechny výsledky pro „{q}“', { q: q.trim() })} →
                </button>
              </li>
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
