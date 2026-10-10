'use client'

import Link from 'next/link'
import { useRef, useState, useTransition } from 'react'
import { useT } from '@/lib/i18n/client'
import { changeSpare, clearSetWanted, markByNumbers, markRestWanted, toggleOwned, toggleWant, type QuickState } from '@/app/actions/collection'

export type GridCard = { id: string; localId: string; name: string; image: string | null; price: string | null }
type Mode = 'view' | 'owned' | 'want' | 'spare'

const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: 'view', label: 'Prohlížet', hint: 'Klepnutím otevřeš detail karty.' },
  { id: 'owned', label: 'Mám', hint: 'Klepni na karty, které máš. Dalším klepnutím zrušíš.' },
  { id: 'want', label: 'Chybí', hint: 'Klepni na karty, které sháníš.' },
  { id: 'spare', label: 'Navíc', hint: 'Každé klepnutí přidá kus navíc k výměně. Tlačítkem − ubereš.' },
]

/**
 * Mřížka karet sady. Přihlášený uživatel si v ní rychle odklikává sbírku.
 * Změny se ukážou hned (optimisticky) a server vrátí skutečný stav.
 */
export function SetGrid({
  cards,
  initial,
  loggedIn,
  officialCount,
  setId,
  baseCount,
}: {
  cards: GridCard[]
  initial: Record<string, QuickState>
  loggedIn: boolean
  officialCount: number
  setId: string
  // Počet karet základní sady (bez secret rare); 0 = sada ho nemá (promo).
  baseCount: number
}) {
  const t = useT()
  const [mode, setMode] = useState<Mode>('view')
  // Zobrazení: mřížka, nebo album po 9 kartách (stránky jako v pořadači, prázdné kapsy = karty, které nemám).
  const [layout, setLayout] = useState<'grid' | 'album'>('grid')
  const [page, setPage] = useState(0)
  const PER_PAGE = 9
  const pages = Math.max(1, Math.ceil(cards.length / PER_PAGE))
  const [state, setState] = useState(initial)
  const [, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const ownedCount = cards.filter((c) => (state[c.id]?.owned ?? 0) > 0).length
  const wantCount = cards.filter((c) => state[c.id]?.want).length
  const spareCount = cards.reduce((s, c) => s + (state[c.id]?.spare ?? 0), 0)

  // Karty, u kterých se právě ukládá — další klepnutí se ignoruje (dvojklik by poslal dvě protichůdné změny).
  const inFlight = useRef(new Set<string>())

  function apply(cardId: string, optimistic: QuickState, call: () => Promise<QuickState>) {
    if (inFlight.current.has(cardId)) return
    inFlight.current.add(cardId)
    const prev = state[cardId] ?? { owned: 0, spare: 0, want: false }
    setState((s) => ({ ...s, [cardId]: optimistic }))
    startTransition(async () => {
      try {
        const real = await call()
        if (real.error) {
          setState((s) => ({ ...s, [cardId]: prev }))
          setError(real.error)
        } else {
          setState((s) => ({ ...s, [cardId]: real }))
          setError(null)
        }
      } catch {
        setState((s) => ({ ...s, [cardId]: prev }))
        setError(t('Uložení se nepovedlo. Jsi přihlášený?'))
      } finally {
        inFlight.current.delete(cardId)
      }
    })
  }

  const [bulkBusy, setBulkBusy] = useState(false)
  const hasSecret = baseCount > 0 && cards.length > baseCount

  // Hromadně: co nemám, to mi chybí (nebo naopak vše zrušit).
  // Rychlé označení podle čísel („1, 5, 23-30, TG05“) v režimu Mám / Chybí.
  const [numbers, setNumbers] = useState('')
  const [numbersInfo, setNumbersInfo] = useState<string | null>(null)
  async function byNumbers() {
    if (!numbers.trim() || (mode !== 'owned' && mode !== 'want')) return
    setBulkBusy(true)
    try {
      const res = await markByNumbers(setId, numbers, mode)
      const hit = new Set(res.ids)
      setState((s) => {
        const next = { ...s }
        for (const id of hit) {
          const cur = next[id] ?? { owned: 0, spare: 0, want: false }
          next[id] = mode === 'owned' ? { ...cur, owned: Math.max(cur.owned, 1), want: false } : { ...cur, want: cur.owned ? cur.want : true }
        }
        return next
      })
      setNumbersInfo(
        t('Označeno: {n} {cards}.', {
          n: res.ids.length,
          cards: res.ids.length === 1 ? t('karta') : res.ids.length >= 2 && res.ids.length <= 4 ? t('karty') : t('karet'),
        }) + (res.notFound.length ? ' ' + t('Nenalezeno: {list}.', { list: res.notFound.slice(0, 10).join(', ') }) : ''),
      )
      setNumbers('')
      setError(null)
    } catch {
      setError(t('Uložení se nepovedlo. Jsi přihlášený?'))
    } finally {
      setBulkBusy(false)
    }
  }

  async function bulk(kind: 'all' | 'base' | 'clear') {
    if (kind === 'clear' && !confirm(t('Zrušit všechny chybějící karty v této sadě?'))) return
    setBulkBusy(true)
    try {
      const wantedIds = kind === 'clear' ? [] : await markRestWanted(setId, kind === 'base')
      if (kind === 'clear') await clearSetWanted(setId)
      const w = new Set(wantedIds)
      setState((s) => {
        const next = { ...s }
        for (const c of cards) {
          const cur = next[c.id] ?? { owned: 0, spare: 0, want: false }
          next[c.id] = { ...cur, want: w.has(c.id) }
        }
        return next
      })
      setError(null)
    } catch {
      setError(t('Uložení se nepovedlo. Jsi přihlášený?'))
    } finally {
      setBulkBusy(false)
    }
  }

  function onCard(cardId: string) {
    const cur = state[cardId] ?? { owned: 0, spare: 0, want: false }
    if (mode === 'owned')
      apply(cardId, cur.owned ? { owned: 0, spare: 0, want: cur.want } : { ...cur, owned: 1, want: false }, () =>
        toggleOwned(cardId),
      )
    if (mode === 'want') apply(cardId, { ...cur, want: !cur.want }, () => toggleWant(cardId))
    if (mode === 'spare')
      apply(cardId, { owned: Math.max(cur.owned, cur.spare + 2), spare: cur.spare + 1, want: false }, () =>
        changeSpare(cardId, 1),
      )
  }

  return (
    <div className="mt-6">
      {loggedIn ? (
        <div className="sticky top-[120px] z-10 -mx-4 border-b border-line bg-[color-mix(in_srgb,var(--bg-primary)_95%,transparent)] px-4 py-3 backdrop-blur md:top-16">
          <div className="flex flex-wrap items-center gap-2">
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                  mode === m.id
                    ? 'bg-accent-strong text-on-accent'
                    : 'border border-line-strong'
                }`}
              >
                {t(m.label)}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-subtle">{t(MODES.find((m) => m.id === mode)!.hint)}</p>
          {(mode === 'want' || mode === 'owned') && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => bulk('all')}
                className="rounded-full bg-orange-500 px-3 py-1 font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
              >
                {bulkBusy ? t('Ukládám…') : t('Vše, co nemám, mi chybí')}
              </button>
              {hasSecret && (
                <button
                  type="button"
                  disabled={bulkBusy}
                  onClick={() => bulk('base')}
                  className="rounded-full border border-orange-400 px-3 py-1 font-semibold text-orange-700 disabled:opacity-50 dark:text-orange-300"
                >
                  {t('Jen základní 1–{n} (bez secret)', { n: baseCount })}
                </button>
              )}
              {wantCount > 0 && (
                <button type="button" disabled={bulkBusy} onClick={() => bulk('clear')} className="underline">
                  {t('Zrušit chybějící v sadě')}
                </button>
              )}
            </div>
          )}
          {(mode === 'want' || mode === 'owned') && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                byNumbers()
              }}
              className="mt-2 flex flex-wrap items-center gap-2 text-xs"
            >
              <input
                value={numbers}
                onChange={(e) => setNumbers(e.target.value)}
                placeholder={t('Čísla karet: 1, 5, 23-30, 145')}
                className="min-w-0 flex-1 rounded-lg border border-line-strong bg-card px-3 py-1.5 text-sm"
              />
              <button
                disabled={bulkBusy || !numbers.trim()}
                className="rounded-full bg-accent-strong px-3 py-1.5 font-semibold text-on-accent disabled:opacity-50"
              >
                {mode === 'owned' ? t('Označit jako Mám') : t('Označit jako Chybí')}
              </button>
              {numbersInfo && <span className="w-full text-subtle">{numbersInfo}</span>}
            </form>
          )}
          <div className="mt-2 flex items-center gap-3 text-xs">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface">
              <div
                className="h-full rounded-full bg-green-500 transition-all"
                style={{ width: `${Math.min(100, (ownedCount / Math.max(officialCount, 1)) * 100)}%` }}
              />
            </div>
            <span className="shrink-0 font-medium">
              {t('Mám {owned}/{total} · chybí {want} · navíc {spare}', { owned: ownedCount, total: officialCount, want: wantCount, spare: spareCount })}
            </span>
          </div>
          {error && <p className="mt-2 text-xs text-red-600">{t(error)}</p>}
        </div>
      ) : (
        <p className="rounded-xl bg-accent-soft px-4 py-3 text-sm text-fg">
          <Link href="/prihlaseni" className="font-semibold underline">
            {t('Přihlas se')}
          </Link>{' '}
          {t('a odklikávej si, které karty máš, které ti chybí a které máš navíc.')}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-subtle">{t('Zobrazení:')}</span>
        {(
          [
            ['grid', t('Mřížka')],
            ['album', t('Album')],
          ] as const
        ).map(([l, label]) => (
          <button
            key={l}
            type="button"
            onClick={() => setLayout(l)}
            className={`rounded-full px-3 py-1 font-medium ${layout === l ? 'bg-accent-strong text-on-accent' : 'border border-line-strong'}`}
          >
            {l === 'album' ? '📖 ' : '▦ '}
            {label}
          </button>
        ))}
      </div>

      {layout === 'album' && (
        <div className="mx-auto mt-4 max-w-xl">
          {/* Stránka alba: 3×3 kapsy jako v pořadači. Prázdná kapsa = karta, kterou nemám. */}
          <div className="grid grid-cols-3 gap-2 rounded-panel border-4 border-slate-700 bg-slate-800 p-3 shadow-inner sm:gap-3 sm:p-4">
            {cards.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE).map((c) => {
              const s = state[c.id] ?? { owned: 0, spare: 0, want: false }
              const pocket = s.owned ? (
                <div className="relative aspect-[63/88] overflow-hidden rounded-md bg-accent-strong shadow-md ring-1 ring-white/20">
                  {c.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.image} alt={c.name} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center p-2 text-center text-xs text-slate-300">{c.name}</div>
                  )}
                  {/* Lesk fólie kapsy. */}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/15 via-transparent to-transparent" />
                </div>
              ) : (
                <div
                  className={`relative grid aspect-[63/88] place-items-center overflow-hidden rounded-md border-2 border-dashed p-1 text-center ${
                    s.want ? 'border-orange-400 bg-orange-500/10' : 'border-slate-500 bg-slate-900/40'
                  }`}
                >
                  {c.image && (
                    // Obrys karty jen velmi slabě, ať je jasné, co do kapsy patří.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.image} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-10 grayscale" />
                  )}
                  <div className="relative">
                    <p className="text-lg font-black text-slate-300 sm:text-2xl">{c.localId}</p>
                    <p className="line-clamp-2 text-[10px] text-subtle sm:text-xs">{c.name}</p>
                    {s.want && <p className="mt-1 text-[10px] font-semibold text-orange-300">{t('chybí')}</p>}
                  </div>
                </div>
              )
              return (
                <div key={c.id}>
                  {mode === 'view' || !loggedIn ? (
                    <Link href={`/karta/${encodeURIComponent(c.id)}`} className="block">
                      {pocket}
                    </Link>
                  ) : (
                    <button type="button" onClick={() => onCard(c.id)} className="block w-full">
                      {pocket}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
          <div className="mt-3 flex items-center justify-between text-sm">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="rounded-full border border-line-strong px-4 py-1.5 font-medium disabled:opacity-40"
            >
              ← {t('Předchozí')}
            </button>
            <span className="text-subtle">{t('Strana {page} z {pages}', { page: page + 1, pages })}</span>
            <button
              type="button"
              disabled={page >= pages - 1}
              onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
              className="rounded-full border border-line-strong px-4 py-1.5 font-medium disabled:opacity-40"
            >
              {t('Další')} →
            </button>
          </div>
        </div>
      )}

      <ul className={`mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 ${layout === 'album' ? 'hidden' : ''}`}>
        {cards.map((c) => {
          const s = state[c.id] ?? { owned: 0, spare: 0, want: false }
          // Neoznačené karty v režimu úprav ztlumené; chybějící šedé jen v obrázku, okraj zůstává oranžový.
          const dim = loggedIn && mode !== 'view' && !s.owned && !s.want
          const tile = (
            <>
              <div
                className={`relative aspect-[63/88] overflow-hidden rounded-lg bg-surface shadow-sm transition ${
                  dim ? 'opacity-40 grayscale' : ''
                } ${s.want ? 'ring-4 ring-orange-400' : s.owned ? 'ring-2 ring-green-500' : ''}`}
              >
                {c.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.image} alt={c.name} loading="lazy" className={`h-full w-full object-cover ${s.want ? 'opacity-60 grayscale' : ''}`} />
                ) : (
                  <div className="grid h-full place-items-center p-2 text-center text-xs text-subtle">{c.name}</div>
                )}
                <div className="absolute left-1 top-1 flex flex-col gap-1">
                  {s.owned > 0 && <Badge className="bg-green-600">✓ {s.owned > 1 ? s.owned : ''}</Badge>}
                  {s.want && <Badge className="bg-orange-500">{t('chybí')}</Badge>}
                  {s.spare > 0 && <Badge className="bg-blue-600">+{s.spare} {t('navíc')}</Badge>}
                </div>
              </div>
              <p className="mt-1.5 truncate text-xs font-medium">
                <span className="text-subtle">{c.localId}</span> {c.name}
              </p>
              {c.price && <p className="text-xs text-subtle">≈ {c.price}</p>}
            </>
          )
          return (
            <li key={c.id} className="relative">
              {mode === 'view' || !loggedIn ? (
                <Link href={`/karta/${encodeURIComponent(c.id)}`} className="group block">
                  {tile}
                </Link>
              ) : (
                <button type="button" onClick={() => onCard(c.id)} className="block w-full text-left">
                  {tile}
                </button>
              )}
              {mode === 'spare' && s.spare > 0 && (
                <button
                  type="button"
                  aria-label={t('Ubrat kus navíc')}
                  onClick={() =>
                    apply(c.id, { ...s, spare: s.spare - 1, owned: Math.max(s.owned - 1, 0) }, () => changeSpare(c.id, -1))
                  }
                  className="absolute right-1 top-1 grid h-8 w-8 place-items-center rounded-full bg-card text-lg font-bold text-fg shadow"
                >
                  −
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold text-white shadow ${className}`}>{children}</span>
}
