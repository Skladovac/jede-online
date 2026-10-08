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
        <div className="sticky top-[106px] z-10 -mx-4 border-b border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 md:top-14">
          <div className="flex flex-wrap items-center gap-2">
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                  mode === m.id
                    ? 'bg-slate-900 text-white dark:bg-yellow-400 dark:text-slate-900'
                    : 'border border-slate-300 dark:border-slate-700'
                }`}
              >
                {t(m.label)}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">{t(MODES.find((m) => m.id === mode)!.hint)}</p>
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
                className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
              />
              <button
                disabled={bulkBusy || !numbers.trim()}
                className="rounded-full bg-slate-900 px-3 py-1.5 font-semibold text-white disabled:opacity-50 dark:bg-yellow-400 dark:text-slate-900"
              >
                {mode === 'owned' ? t('Označit jako Mám') : t('Označit jako Chybí')}
              </button>
              {numbersInfo && <span className="w-full text-slate-500">{numbersInfo}</span>}
            </form>
          )}
          <div className="mt-2 flex items-center gap-3 text-xs">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
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
        <p className="rounded-xl bg-yellow-50 px-4 py-3 text-sm text-yellow-900 dark:bg-yellow-400/10 dark:text-yellow-100">
          <Link href="/prihlaseni" className="font-semibold underline">
            {t('Přihlas se')}
          </Link>{' '}
          {t('a odklikávej si, které karty máš, které ti chybí a které máš navíc.')}
        </p>
      )}

      <ul className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {cards.map((c) => {
          const s = state[c.id] ?? { owned: 0, spare: 0, want: false }
          // Neoznačené karty v režimu úprav ztlumené; chybějící šedé jen v obrázku, okraj zůstává oranžový.
          const dim = loggedIn && mode !== 'view' && !s.owned && !s.want
          const tile = (
            <>
              <div
                className={`relative aspect-[63/88] overflow-hidden rounded-lg bg-slate-200 shadow-sm transition dark:bg-slate-800 ${
                  dim ? 'opacity-40 grayscale' : ''
                } ${s.want ? 'ring-4 ring-orange-400' : s.owned ? 'ring-2 ring-green-500' : ''}`}
              >
                {c.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.image} alt={c.name} loading="lazy" className={`h-full w-full object-cover ${s.want ? 'opacity-60 grayscale' : ''}`} />
                ) : (
                  <div className="grid h-full place-items-center p-2 text-center text-xs text-slate-500">{c.name}</div>
                )}
                <div className="absolute left-1 top-1 flex flex-col gap-1">
                  {s.owned > 0 && <Badge className="bg-green-600">✓ {s.owned > 1 ? s.owned : ''}</Badge>}
                  {s.want && <Badge className="bg-orange-500">{t('chybí')}</Badge>}
                  {s.spare > 0 && <Badge className="bg-blue-600">+{s.spare} {t('navíc')}</Badge>}
                </div>
              </div>
              <p className="mt-1.5 truncate text-xs font-medium">
                <span className="text-slate-400">{c.localId}</span> {c.name}
              </p>
              {c.price && <p className="text-xs text-slate-500">≈ {c.price}</p>}
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
                  className="absolute right-1 top-1 grid h-8 w-8 place-items-center rounded-full bg-white text-lg font-bold text-slate-900 shadow"
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
