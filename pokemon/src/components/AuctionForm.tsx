'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { Plus, Search, X } from 'lucide-react'
import { createAuction } from '@/app/actions/auctions'
import { CardImg } from '@/components/CardImg'
import { btnPrimary } from '@/components/design'
import { useT } from '@/lib/i18n/client'
import type { FormState } from '@/lib/validation'

type Hit = { id: string; name: string; number: string; set: string; image: string | null }
type Picked = Hit & { value: string }

const input =
  'min-h-[46px] w-full rounded-xl border border-line-strong bg-card px-3.5 text-fg outline-none transition placeholder:text-subtle focus:border-brand-blue focus:ring-4 focus:ring-[rgba(42,117,187,0.15)]'
const label = 'mb-1.5 block text-[13.5px] font-semibold text-fg'

/** Výchozí konec: zítra ve 20:00 (pražský čas ve formátu pro datetime-local). */
function defaultEnd() {
  const d = new Date(Date.now() + 86_400_000)
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Prague', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d).map((x) => [x.type, x.value]),
  )
  return `${p.year}-${p.month}-${p.day}T20:00`
}

/** Formulář „Nová aukce“: hledání karet a produktů z katalogu (stejný našeptávač jako vyhledávání), odkaz, konec. */
export function AuctionForm({ sites, maxItems }: { sites: string[]; maxItems: number }) {
  const t = useT()
  const [state, action, pending] = useActionState<FormState, FormData>(createAuction, undefined)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [picked, setPicked] = useState<Picked[]>([])
  const [end] = useState(defaultEnd)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    clearTimeout(timer.current)
    if (q.trim().length < 2) return setHits([])
    const ctrl = new AbortController()
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/hledat?q=${encodeURIComponent(q.trim())}`, { signal: ctrl.signal })
        if (res.ok) setHits(await res.json())
      } catch {
        /* zrušeno */
      }
    }, 250)
    return () => ctrl.abort()
  }, [q])

  const add = (h: Hit) => {
    const value = h.id.startsWith('p') && /^p\d+$/.test(h.id) ? `p:${h.id.slice(1)}` : `c:${h.id}`
    setPicked((p) => (p.some((x) => x.value === value) || p.length >= maxItems ? p : [...p, { ...h, value }]))
    setQ('')
    setHits([])
  }

  return (
    <form action={action} className="space-y-6">
      <div>
        <label htmlFor="a-title" className={label}>
          {t('Název aukce')}
        </label>
        <input id="a-title" name="title" required minLength={3} maxLength={120} placeholder={t('např. Charizard ex 199/165 SIR, top stav')} className={input} />
      </div>

      <div>
        <p className={label}>{t('Co dražíš')}</p>
        {picked.length > 0 && (
          <ul className="mb-3 grid grid-cols-3 gap-3 sm:grid-cols-5">
            {picked.map((p) => (
              <li key={p.value} className="relative">
                <input type="hidden" name="item" value={p.value} />
                <div className="card-frame aspect-[63/88]">
                  <CardImg src={p.image} alt={p.name} />
                </div>
                <p className="mt-1.5 truncate text-xs font-semibold text-fg">{p.name}</p>
                <p className="truncate font-mono text-[10.5px] text-subtle">{p.number}</p>
                <button
                  type="button"
                  onClick={() => setPicked((x) => x.filter((y) => y.value !== p.value))}
                  aria-label={t('Odebrat')}
                  className="absolute right-1 top-1 z-10 grid h-7 w-7 place-items-center rounded-full bg-card text-fg shadow-[0_2px_8px_rgba(14,27,46,0.25)]"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-3.5 h-[18px] w-[18px] text-subtle" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                if (hits[0]) add(hits[0])
              }
            }}
            placeholder={t('Hledej kartu nebo produkt: název, číslo (SVI 045), ETB…')}
            aria-label={t('Přidat kartu nebo produkt')}
            className={`${input} pl-10`}
          />
          {hits.length > 0 && (
            <ul className="absolute inset-x-0 top-full z-20 mt-1.5 max-h-80 overflow-y-auto rounded-[14px] border border-line bg-card py-1.5 shadow-[0_16px_40px_-8px_rgba(14,27,46,0.25)]">
              {hits.map((h) => (
                <li key={h.id}>
                  <button type="button" onClick={() => add(h)} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-card-hover">
                    <span className="block aspect-[63/88] w-9 shrink-0 overflow-hidden rounded bg-surface">
                      <CardImg src={h.image} alt="" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-fg">{h.name}</span>
                      <span className="block truncate text-xs text-muted">
                        {h.set} · <span className="font-mono">{h.number}</span>
                      </span>
                    </span>
                    <Plus className="h-4 w-4 shrink-0 text-accent" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="mt-1.5 text-xs text-muted">{t('Jedna nebo víc položek (nejvýš {n}).', { n: maxItems })}</p>
      </div>

      <div>
        <label htmlFor="a-url" className={label}>
          {t('Odkaz na aukci')}
        </label>
        <input id="a-url" name="url" type="url" inputMode="url" required maxLength={500} placeholder="https://www.facebook.com/groups/…" className={input} />
        <p className="mt-1.5 text-xs text-muted">{t('Povolené weby: {list}.', { list: sites.join(', ') })}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="a-end" className={label}>
            {t('Konec aukce')}
          </label>
          <input id="a-end" name="endsAt" type="datetime-local" required defaultValue={end} className={input} />
          <p className="mt-1.5 text-xs text-muted">{t('Den, hodina a minuta (český čas).')}</p>
        </div>
        <div>
          <label htmlFor="a-price" className={label}>
            {t('Vyvolávací cena (nepovinné)')}
          </label>
          <input id="a-price" name="startPrice" inputMode="numeric" placeholder={t('např. 500 Kč')} className={input} />
        </div>
      </div>

      <div>
        <label htmlFor="a-note" className={label}>
          {t('Poznámka (nepovinné)')}
        </label>
        <textarea id="a-note" name="note" rows={3} maxLength={500} placeholder={t('Stav karty, poštovné, jak se přihazuje…')} className={`${input} py-3`} />
      </div>

      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <button disabled={pending || !picked.length} className={`${btnPrimary} disabled:opacity-50`}>
        {pending ? '…' : t('Zveřejnit aukci')}
      </button>
    </form>
  )
}
