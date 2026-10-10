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
        className="relative"
        onSubmit={(e) => {
          e.preventDefault()
          if (active >= 0 && hits[active]) go(hits[active].href)
          else if (q.trim().length >= 2) go(`/hledat?q=${encodeURIComponent(q.trim())}`)
        }}
      >
        <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
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
          placeholder={t('Hledej karty, sady, čísla karet…')}
          aria-label={t('Hledat kartu')}
          autoComplete="off"
          className="h-11 w-full rounded-panel border border-line-strong bg-card pl-10 pr-4 text-[15px] text-fg outline-none transition-colors duration-200 placeholder:text-subtle focus:border-accent focus:ring-2 focus:ring-accent-soft"
        />
      </form>

      {open && q.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-panel border border-line-strong bg-card shadow-xl">
          {hits.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted">{t('Nic jsme nenašli.')}</p>
          ) : (
            <ul>
              {hits.map((h, i) => (
                <li key={h.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(h.href)}
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left ${i === active ? 'bg-card-hover' : ''}`}
                  >
                    <span className="h-14 w-10 shrink-0 overflow-hidden rounded bg-surface">
                      {h.image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={h.image} alt="" className="h-full w-full object-cover" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{h.name}</span>
                      <span className="block truncate text-xs text-muted">
                        {h.set} · {h.number}
                      </span>
                    </span>
                    {h.price && <span className="shrink-0 text-xs tabular-nums text-muted">≈ {h.price}</span>}
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => go(`/hledat?q=${encodeURIComponent(q.trim())}`)}
                  className="w-full border-t border-line px-4 py-2.5 text-left text-sm font-medium text-accent"
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
