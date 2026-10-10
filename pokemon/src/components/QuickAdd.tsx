'use client'

import { useActionState, useEffect, useRef } from 'react'
import { quickAdd, type QuickAddState, type QuickHit } from '@/app/actions/collection'
import { CardImg } from '@/components/CardImg'
import { cardImage } from '@/lib/format'
import { useT } from '@/lib/i18n/client'

/**
 * „Přidej kartu číslem“: rychlé zadávání hromádky karet ze stolu. Po přidání se pole vyčistí a zůstane aktivní,
 * takže jde psát jedno číslo za druhým (MEP 101 ⏎, SVI 045 ⏎, …).
 */
export function QuickAdd() {
  const t = useT()
  const [state, action, pending] = useActionState<QuickAddState, FormData>(quickAdd, {})
  const input = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if ((state.added || (state.batch && !state.batch.notFound.length && !state.batch.ambiguous.length)) && input.current) {
      input.current.value = ''
      input.current.focus()
    }
  }, [state])

  return (
    <section className="rounded-panel border border-line bg-card p-4 sm:p-5" aria-labelledby="quick-add-title">
      <h2 id="quick-add-title" className="font-bold text-fg">
        ⚡ {t('Přidej kartu číslem')}
      </h2>
      <p className="mt-1 text-sm text-muted">{t('Napiš kód sady a číslo z karty vlevo dole, třeba MEP 101, SVI 045 nebo 045/198. Enter kartu rovnou přidá.')}</p>
      <p className="mt-0.5 text-xs text-subtle">{t('Víc karet najednou: odděl je čárkou nebo novým řádkem (Shift+Enter), počet zapiš jako „2x SVI 045“.')}</p>
      <form action={action} className="mt-3 flex gap-2">
        <label htmlFor="quick-add-q" className="sr-only">
          {t('Číslo karty')}
        </label>
        <textarea
          ref={input}
          id="quick-add-q"
          name="q"
          rows={1}
          defaultValue={state.added || state.batch ? '' : state.q}
          autoComplete="off"
          autoCapitalize="characters"
          placeholder="MEP 101, SVI 045, 2x 30C 071"
          onKeyDown={(e) => {
            // Enter odešle, Shift+Enter = nový řádek (seznam karet).
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              e.currentTarget.form?.requestSubmit()
            }
          }}
          className="max-h-40 min-h-11 min-w-0 flex-1 resize-y rounded-panel border border-line-strong bg-surface px-3 py-2.5 text-base text-fg outline-none placeholder:text-subtle focus:border-accent focus:ring-2 focus:ring-accent-soft"
        />
        <button
          disabled={pending}
          className="h-11 shrink-0 rounded-panel bg-accent-strong px-5 font-semibold text-on-accent transition-colors duration-200 hover:bg-accent-hover disabled:opacity-50"
        >
          {pending ? '…' : t('Přidat')}
        </button>
      </form>

      <div aria-live="polite">
        {state.error && <p className="mt-3 text-sm text-danger">{state.error}</p>}
        {state.added && (
          <div className="mt-3 flex items-center gap-3 rounded-panel bg-[color-mix(in_srgb,var(--positive)_12%,transparent)] p-2.5">
            <Thumb hit={state.added} />
            <p className="min-w-0 text-sm text-fg">
              <span className="font-semibold text-positive">✓ {t('Přidáno')}:</span> {state.added.name}{' '}
              <span className="text-muted">({state.added.number})</span>
              <span className="block text-xs text-muted">{t('Teď máš {n} ks', { n: state.added.owned })}</span>
            </p>
          </div>
        )}
        {state.batch && (
          <div className="mt-3 space-y-3 text-sm">
            {state.batch.added.length > 0 && (
              <div className="rounded-panel bg-[color-mix(in_srgb,var(--positive)_12%,transparent)] p-3">
                <p className="font-semibold text-positive">
                  ✓ {t('Přidáno {n} karet', { n: state.batch.added.reduce((s, a) => s + a.qty, 0) })}
                </p>
                <ul className="mt-1 space-y-0.5 text-fg">
                  {state.batch.added.map((a) => (
                    <li key={a.id}>
                      {a.qty > 1 && <span className="font-semibold">{a.qty}× </span>}
                      {a.name} <span className="text-muted">({a.number})</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {state.batch.notFound.length > 0 && (
              <p className="text-danger">
                {t('Nenašli jsme:')} {state.batch.notFound.join(', ')}
              </p>
            )}
            {state.batch.ambiguous.map((a) => (
              <div key={a.q}>
                <p className="mb-2 text-muted">{t('„{q}“ odpovídá víc kartám — vyber:', { q: a.q })}</p>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {a.hits.map((h) => (
                    <li key={h.id}>
                      <form action={action}>
                        <input type="hidden" name="cardId" value={h.id} />
                        <button className="flex w-full items-center gap-3 rounded-panel border border-line p-2 text-left transition-colors duration-200 hover:border-line-strong hover:bg-card-hover">
                          <Thumb hit={h} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-fg">{h.name}</span>
                            <span className="block truncate text-xs text-muted">
                              {h.set} · {h.number}
                            </span>
                          </span>
                          <span className="shrink-0 text-sm font-semibold text-accent">+ {t('Přidat')}</span>
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
        {state.hits && (
          <div className="mt-3">
            <p className="mb-2 text-sm text-muted">{t('Víc shod — vyber tu svoji:')}</p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {state.hits.map((h) => (
                <li key={h.id}>
                  <form action={action}>
                    <input type="hidden" name="cardId" value={h.id} />
                    <button className="flex w-full items-center gap-3 rounded-panel border border-line p-2 text-left transition-colors duration-200 hover:border-line-strong hover:bg-card-hover">
                      <Thumb hit={h} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-fg">{h.name}</span>
                        <span className="block truncate text-xs text-muted">
                          {h.set} · {h.number}
                        </span>
                        {h.owned > 0 && <span className="block text-xs text-positive">{t('máš {n} ks', { n: h.owned })}</span>}
                      </span>
                      <span className="shrink-0 text-sm font-semibold text-accent">+ {t('Přidat')}</span>
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}

function Thumb({ hit }: { hit: QuickHit }) {
  return (
    <span className="block aspect-[63/88] w-10 shrink-0 overflow-hidden rounded bg-surface">
      <CardImg src={cardImage(hit.imageUrl)} alt={hit.name} />
    </span>
  )
}
