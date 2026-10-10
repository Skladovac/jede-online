'use client'

import { useActionState, useMemo, useState } from 'react'
import { bulkOffer } from '@/app/actions/collection'
import { CardImg } from '@/components/CardImg'
import { cardImage } from '@/lib/format'
import { useT } from '@/lib/i18n/client'
import type { FormState } from '@/lib/validation'

export type BulkItem = {
  id: string
  cardName: string
  number: string
  imageUrl: string | null
  setId: string
  setName: string
  variant: string
  quantity: number
  spareQty: number
  offerType: 'TRADE' | 'SELL' | 'GIFT' | null
  priceCzk: number | null
}

const OFFER = { TRADE: 'vyměním', SELL: 'prodám', GIFT: 'daruji' } as const

/** Výběr karet ze sbírky a jedna nabídka pro všechny vybrané (lišta dole). */
export function BulkOffer({ items }: { items: BulkItem[] }) {
  const t = useT()
  const [state, action, pending] = useActionState<FormState, FormData>(bulkOffer, undefined)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState('')
  const [type, setType] = useState<'TRADE' | 'SELL' | 'GIFT'>('TRADE')

  const groups = useMemo(() => {
    const f = filter.trim().toLowerCase()
    const m = new Map<string, { name: string; items: BulkItem[] }>()
    for (const i of items) {
      if (f && !`${i.cardName} ${i.number} ${i.setName}`.toLowerCase().includes(f)) continue
      const g = m.get(i.setId) ?? { name: i.setName, items: [] }
      g.items.push(i)
      m.set(i.setId, g)
    }
    return [...m.entries()]
  }, [items, filter])

  const toggle = (id: string) =>
    setSel((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const toggleGroup = (list: BulkItem[]) =>
    setSel((s) => {
      const n = new Set(s)
      const all = list.every((i) => n.has(i.id))
      for (const i of list) {
        if (all) n.delete(i.id)
        else n.add(i.id)
      }
      return n
    })

  return (
    <form action={action}>
      {[...sel].map((id) => (
        <input key={id} type="hidden" name="ids" value={id} />
      ))}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label htmlFor="bulk-filter" className="sr-only">
          {t('Filtrovat')}
        </label>
        <input
          id="bulk-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t('Filtrovat: jméno, číslo nebo sada…')}
          className="h-11 min-w-0 flex-1 rounded-panel border border-line-strong bg-card px-3 text-base text-fg outline-none placeholder:text-subtle focus:border-accent focus:ring-2 focus:ring-accent-soft"
        />
        <span className="text-sm text-muted tabular-nums">{t('Vybráno: {n}', { n: sel.size })}</span>
        {sel.size > 0 && (
          <button type="button" onClick={() => setSel(new Set())} className="min-h-11 text-sm font-medium text-accent hover:underline">
            {t('Zrušit výběr')}
          </button>
        )}
      </div>

      <div className="space-y-8 pb-44">
        {groups.map(([setId, g]) => {
          const all = g.items.every((i) => sel.has(i.id))
          return (
            <section key={setId}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="font-bold text-fg">
                  {g.name} <span className="text-sm font-normal text-subtle">({g.items.length})</span>
                </h2>
                <button type="button" onClick={() => toggleGroup(g.items)} className="min-h-11 text-sm font-medium text-accent hover:underline">
                  {all ? t('Odznačit sadu') : t('Vybrat celou sadu')}
                </button>
              </div>
              <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-8">
                {g.items.map((i) => {
                  const on = sel.has(i.id)
                  return (
                    <li key={i.id}>
                      <button
                        type="button"
                        onClick={() => toggle(i.id)}
                        aria-pressed={on}
                        aria-label={`${i.cardName} ${i.number}`}
                        className={`relative block w-full rounded-lg p-1 text-left transition-colors duration-200 ${on ? 'bg-accent-soft ring-2 ring-accent' : 'hover:bg-card-hover'}`}
                      >
                        <span className="block aspect-[63/88] overflow-hidden rounded-md bg-surface">
                          <CardImg src={cardImage(i.imageUrl)} alt={i.cardName} />
                        </span>
                        <span
                          aria-hidden
                          className={`absolute left-2 top-2 grid h-6 w-6 place-items-center rounded-md border-2 text-xs font-bold ${on ? 'border-accent bg-accent-strong text-on-accent' : 'border-white/70 bg-black/40 text-transparent'}`}
                        >
                          ✓
                        </span>
                        <span className="mt-1 block truncate text-xs font-medium text-fg">{i.cardName}</span>
                        <span className="block truncate text-[11px] text-subtle tabular-nums">
                          {i.number} · {i.quantity}×{i.variant !== 'NORMAL' ? ` ${i.variant.toLowerCase()}` : ''}
                        </span>
                        {i.offerType && i.spareQty > 0 && (
                          <span className="block truncate text-[11px] font-semibold text-accent">
                            {i.spareQty}× {i.offerType === 'SELL' && i.priceCzk ? `${i.priceCzk} Kč` : t(OFFER[i.offerType])}
                          </span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}
        {!groups.length && <p className="text-muted">{t('Nic neodpovídá filtru.')}</p>}
      </div>

      {/* Lišta s akcí: nad spodní navigací na mobilu. */}
      <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 border-t border-line bg-[color-mix(in_srgb,var(--bg-secondary)_96%,transparent)] backdrop-blur sm:bottom-0">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end gap-3 px-4 py-3">
          <label className="text-xs text-muted">
            {t('Kusů navíc')}
            <input name="spare" type="number" min={1} max={999} defaultValue={1} className="mt-1 block h-11 w-20 rounded-panel border border-line-strong bg-card px-2 text-base text-fg" />
          </label>
          <label className="text-xs text-muted">
            {t('Nabídka')}
            <select
              name="offerType"
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
              className="mt-1 block h-11 rounded-panel border border-line-strong bg-card px-2 text-base text-fg"
            >
              <option value="TRADE">{t('vyměním')}</option>
              <option value="SELL">{t('prodám')}</option>
              <option value="GIFT">{t('daruji za poštovné')}</option>
            </select>
          </label>
          {type === 'SELL' && (
            <label className="text-xs text-muted">
              {t('Cena za kus (Kč)')}
              <input name="priceCzk" type="number" min={1} required className="mt-1 block h-11 w-28 rounded-panel border border-line-strong bg-card px-2 text-base text-fg" />
            </label>
          )}
          <button
            name="mode"
            value="offer"
            disabled={pending || !sel.size}
            className="h-11 rounded-panel bg-accent-strong px-5 font-semibold text-on-accent transition-colors duration-200 hover:bg-accent-hover disabled:opacity-50"
          >
            {t('Nabídnout vybrané ({n})', { n: sel.size })}
          </button>
          <button
            name="mode"
            value="clear"
            formNoValidate
            disabled={pending || !sel.size}
            className="h-11 rounded-panel border border-line-strong px-4 text-sm font-semibold text-muted transition-colors duration-200 hover:text-danger disabled:opacity-50"
          >
            {t('Zrušit nabídku')}
          </button>
          <p aria-live="polite" className="basis-full text-sm">
            {state?.error && <span className="text-danger">{state.error}</span>}
            {state?.ok && <span className="text-positive">✓ {state.ok}</span>}
          </p>
        </div>
      </div>
    </form>
  )
}
