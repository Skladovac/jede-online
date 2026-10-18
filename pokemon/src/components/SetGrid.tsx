'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n/client'
import { changeSpare, clearSetWanted, markByNumbers, markRestWanted, toggleOwned, toggleWant, type QuickState } from '@/app/actions/collection'
import { CardImg } from '@/components/CardImg'
import { POKEMON_TYPES } from '@/lib/pokemon-types'
import { Celebration } from '@/components/Motion'
import { ArrowLeft, ArrowRight, BookOpen, Check, LayoutGrid, Minus } from 'lucide-react'

export type GridCard = { id: string; localId: string; name: string; image: string | null; price: string | null; types?: string[] }
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
  // Filtr podle typu Pokémona (jen když karty v sadě typ mají).
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const setTypes = [...new Set(cards.flatMap((c) => c.types ?? []))].filter((ty) => POKEMON_TYPES[ty])
  const [, startTransition] = useTransition()
  // Po změnách sbírky obnovit uloženou kopii stránky v prohlížeči (jinak tlačítko Zpět ukáže starý stav
  // „chybí“). Jednou po sérii klepnutí, ne po každém — obnova stránky sady je dražší.
  const router = useRouter()
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const dirty = useRef(false)
  const scheduleRefresh = () => {
    dirty.current = true
    clearTimeout(refreshTimer.current)
    refreshTimer.current = setTimeout(() => {
      dirty.current = false
      router.refresh()
    }, 1500)
  }
  // Odchod ze stránky dřív, než časovač doběhne: obnovit hned, ať se po návratu ukáže aktuální stav.
  useEffect(
    () => () => {
      clearTimeout(refreshTimer.current)
      if (dirty.current) router.refresh()
    },
    [router],
  )
  const [error, setError] = useState<string | null>(null)

  const ownedCount = cards.filter((c) => (state[c.id]?.owned ?? 0) > 0).length
  const wantCount = cards.filter((c) => state[c.id]?.want).length
  const spareCount = cards.reduce((s, c) => s + (state[c.id]?.spare ?? 0), 0)
  // Oslava: právě teď (klepnutím) jsem dokončil(a) sadu — ne při pouhém otevření už hotové sady.
  const [celebrate, setCelebrate] = useState(0)
  const prevOwned = useRef(ownedCount)
  useEffect(() => {
    if (prevOwned.current < officialCount && ownedCount >= officialCount && officialCount > 0) setCelebrate((n) => n + 1)
    prevOwned.current = ownedCount
  }, [ownedCount, officialCount])

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
          scheduleRefresh()
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
      scheduleRefresh()
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
      scheduleRefresh()
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
      <Celebration show={celebrate} title={t('Sada kompletní!')} text={t('Máš všech {n} karet. Gratulujeme!', { n: officialCount })} />
      {loggedIn ? (
        <div className="sticky top-[119px] z-10 -mx-4 border-b border-line bg-[color-mix(in_srgb,var(--bg-primary)_88%,transparent)] px-4 py-3.5 backdrop-blur-md sm:-mx-6 sm:px-6 md:top-[67px] lg:top-[68px]">
          <div className="inline-flex flex-wrap gap-1 rounded-xl bg-surface p-1 ring-1 ring-inset ring-line" role="group" aria-label={t('Režim')}>
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                aria-pressed={mode === m.id}
                className={`inline-flex min-h-9 items-center gap-1.5 rounded-[9px] px-3.5 text-sm font-semibold transition ${
                  mode === m.id ? 'bg-card text-fg shadow-soft ring-1 ring-inset ring-line' : 'text-muted hover:text-fg'
                }`}
              >
                {t(m.label)}
                {m.id === 'owned' && <span className="font-mono text-[11px] text-subtle">{ownedCount}</span>}
                {m.id === 'want' && <span className="font-mono text-[11px] text-subtle">{wantCount}</span>}
                {m.id === 'spare' && <span className="font-mono text-[11px] text-subtle">{spareCount}</span>}
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
                className="min-h-8 rounded-lg bg-[var(--ink)] px-3 font-semibold text-white hover:bg-[#1b2c45] disabled:opacity-50 dark:bg-white dark:text-[var(--ink)]"
              >
                {bulkBusy ? t('Ukládám…') : t('Vše, co nemám, mi chybí')}
              </button>
              {hasSecret && (
                <button
                  type="button"
                  disabled={bulkBusy}
                  onClick={() => bulk('base')}
                  className="min-h-8 rounded-lg px-3 font-semibold text-fg ring-1 ring-inset ring-line-strong hover:bg-card disabled:opacity-50"
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
                className="min-h-9 min-w-0 flex-1 rounded-lg border border-line-strong bg-card px-3 text-sm outline-none focus:border-brand-blue focus:ring-4 focus:ring-[rgba(42,117,187,0.15)]"
              />
              <button
                disabled={bulkBusy || !numbers.trim()}
                className="min-h-9 rounded-lg bg-accent-strong px-3 font-semibold text-on-accent disabled:opacity-50"
              >
                {mode === 'owned' ? t('Označit jako Mám') : t('Označit jako Chybí')}
              </button>
              {numbersInfo && <span className="w-full text-subtle">{numbersInfo}</span>}
            </form>
          )}
          <div className="mt-2 flex items-center gap-3 text-xs">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-blue to-brand-blue-dark transition-all dark:from-accent dark:to-brand-blue"
                style={{ width: `${Math.min(100, (ownedCount / Math.max(officialCount, 1)) * 100)}%` }}
              />
            </div>
            <span className="shrink-0 font-mono text-[12px] text-muted">
              {t('Mám {owned}/{total} · chybí {want} · navíc {spare}', { owned: ownedCount, total: officialCount, want: wantCount, spare: spareCount })}
            </span>
          </div>
          {error && <p className="mt-2 text-xs text-danger">{t(error)}</p>}
        </div>
      ) : (
        <p className="rounded-xl bg-surface px-4 py-3 text-sm text-fg ring-1 ring-inset ring-line">
          <Link href="/prihlaseni" className="font-semibold underline">
            {t('Přihlas se')}
          </Link>{' '}
          {t('a odklikávej si, které karty máš, které ti chybí a které máš navíc.')}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-end gap-2 text-sm">
        <div className="inline-flex gap-1 rounded-xl bg-surface p-1 ring-1 ring-inset ring-line" role="group" aria-label={t('Zobrazení:')}>
          {(
            [
              ['grid', t('Mřížka'), LayoutGrid],
              ['album', t('Album'), BookOpen],
            ] as const
          ).map(([l, label, Icon]) => (
            <button
              key={l}
              type="button"
              onClick={() => setLayout(l)}
              aria-pressed={layout === l}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-[9px] px-3 font-semibold transition ${layout === l ? 'bg-card text-fg shadow-soft ring-1 ring-inset ring-line' : 'text-muted hover:text-fg'}`}
            >
              <Icon className="h-4 w-4" strokeWidth={1.9} aria-hidden />
              {label}
            </button>
          ))}
        </div>
      </div>

      {layout === 'album' && (
        <div className="mx-auto mt-4 max-w-xl">
          {/* Stránka alba: 3×3 kapsy jako v pořadači. Prázdná kapsa = karta, kterou nemám. */}
          <div className="grid grid-cols-3 gap-2 rounded-[18px] bg-[#16243a] p-3 shadow-[inset_0_2px_10px_rgba(0,0,0,0.45),0_20px_40px_-20px_rgba(14,27,46,0.6)] ring-1 ring-[rgba(255,255,255,0.06)] sm:gap-3 sm:p-4">
            {cards.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE).map((c) => {
              const s = state[c.id] ?? { owned: 0, spare: 0, want: false }
              const pocket = s.owned ? (
                <div className="relative aspect-[63/88] overflow-hidden rounded-md bg-accent-strong shadow-md ring-1 ring-white/20">
                  {c.image ? (
                    <CardImg src={c.image} alt={c.name} />
                  ) : (
                    <div className="grid h-full place-items-center p-2 text-center text-xs text-[#c9d3e3]">{c.name}</div>
                  )}
                  {/* Lesk fólie kapsy. */}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/15 via-transparent to-transparent" />
                </div>
              ) : (
                <div
                  className={`relative grid aspect-[63/88] place-items-center overflow-hidden rounded-md border-2 border-dashed p-1 text-center ${
                    s.want ? 'border-brand-yellow bg-[rgba(255,203,5,0.08)]' : 'border-[rgba(255,255,255,0.18)] bg-[rgba(0,0,0,0.2)]'
                  }`}
                >
                  {c.image && (
                    // Obrys karty jen velmi slabě, ať je jasné, co do kapsy patří.
                    <span className="absolute inset-0">
                      <CardImg src={c.image} alt="" className="opacity-10 grayscale" />
                    </span>
                  )}
                  <div className="relative">
                    <p className="font-mono text-lg font-bold text-[#c9d3e3] sm:text-2xl">{c.localId}</p>
                    <p className="line-clamp-2 text-[10px] text-subtle sm:text-xs">{c.name}</p>
                    {s.want && <p className="mt-1 text-[10px] font-semibold text-brand-yellow">{t('chybí')}</p>}
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
              className="inline-flex items-center gap-1 rounded-full border border-line-strong px-4 py-1.5 font-medium disabled:opacity-40"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              {t('Předchozí')}
            </button>
            <span className="text-subtle">{t('Strana {page} z {pages}', { page: page + 1, pages })}</span>
            <button
              type="button"
              disabled={page >= pages - 1}
              onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
              className="inline-flex items-center gap-1 rounded-full border border-line-strong px-4 py-1.5 font-medium disabled:opacity-40"
            >
              {t('Další')}
              <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            </button>
          </div>
        </div>
      )}

      {setTypes.length > 1 && layout === 'grid' && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm" role="group" aria-label={t('Filtr podle typu')}>
          <button
            type="button"
            onClick={() => setTypeFilter(null)}
            aria-pressed={!typeFilter}
            className={`min-h-9 rounded-full bg-card px-3.5 font-semibold transition ${!typeFilter ? 'text-fg ring-[1.5px] ring-inset ring-fg' : 'text-muted ring-1 ring-inset ring-line hover:text-fg'}`}
          >
            {t('Všechny')}
          </button>
          {setTypes.map((ty) => {
            const info = POKEMON_TYPES[ty]
            const on = typeFilter === ty
            return (
              <button
                key={ty}
                type="button"
                onClick={() => setTypeFilter(on ? null : ty)}
                aria-pressed={on}
                className={`inline-flex min-h-9 items-center gap-2 rounded-full bg-card pl-2.5 pr-3.5 font-semibold transition ${on ? 'text-fg ring-[1.5px] ring-inset ring-fg' : 'text-muted ring-1 ring-inset ring-line hover:text-fg'}`}
              >
                <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: info.color }} />
                {t(info.label)}
              </button>
            )
          })}
        </div>
      )}

      <ul className={`mt-7 grid grid-cols-2 gap-x-4 gap-y-8 min-[480px]:grid-cols-3 sm:gap-x-6 sm:gap-y-9 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 ${layout === 'album' ? 'hidden' : ''}`}>
        {cards.filter((c) => !typeFilter || c.types?.includes(typeFilter)).map((c) => {
          const s = state[c.id] ?? { owned: 0, spare: 0, want: false }
          // Galerie: karta, kterou nemám, je vybledlá (jen když už v sadě něco mám — nováček vidí vše barevně).
          // V režimu úprav ztlumené vše neoznačené; po najetí se karta vždy ukáže v barvě.
          const faded = loggedIn && !s.owned && (mode !== 'view' ? !s.want : ownedCount > 0)
          const tile = (
            <>
              <div className={`card-frame aspect-[63/88] ${faded ? 'opacity-45 grayscale-[0.9] transition-[opacity,filter] duration-300 group-hover:opacity-100 group-hover:grayscale-0' : ''}`}>
                {c.image ? (
                  <CardImg src={c.image} alt={c.name} />
                ) : (
                  <div className="grid h-full place-items-center p-2 text-center text-xs text-subtle">{c.name}</div>
                )}
              </div>
              {/* Stav ve sbírce: zelená fajfka (mám), počet navíc, „hledám“. */}
              <div className="pointer-events-none absolute right-1.5 top-1.5 z-10 flex flex-col items-end gap-1">
                {s.owned > 0 && (
                  <span title={t('mám')} className="grid h-[26px] min-w-[26px] place-items-center rounded-full bg-[#1f8a5b] px-1 text-[11px] font-bold text-white shadow-[0_0_0_2px_#fff,0_4px_10px_-2px_rgba(0,0,0,0.35)]">
                    {s.owned > 1 ? `${s.owned}×` : <Check className="h-[15px] w-[15px]" strokeWidth={2.8} aria-label={t('mám')} />}
                  </span>
                )}
                {s.spare > 0 && (
                  <span title={t('navíc')} className="rounded-full bg-[var(--ink)] px-2 py-0.5 font-mono text-[11px] font-bold text-brand-yellow shadow-[0_0_0_2px_#fff,0_4px_10px_-2px_rgba(0,0,0,0.35)]">
                    +{s.spare}
                  </span>
                )}
                {s.want && !s.owned && (
                  <span className="rounded-full bg-brand-yellow px-2 py-0.5 text-[10.5px] font-bold text-[var(--ink)] shadow-[0_0_0_2px_#fff,0_4px_10px_-2px_rgba(0,0,0,0.35)]">{t('chybí')}</span>
                )}
              </div>
              <div className="mt-3 flex items-baseline justify-between gap-2">
                <p className={`truncate text-[14.5px] font-semibold ${faded ? 'text-muted' : 'text-fg'}`}>{c.name}</p>
                <span className="shrink-0 font-mono text-[11.5px] text-subtle">{c.localId}</span>
              </div>
              {c.price && <p className="mt-0.5 truncate text-[13px] tabular-nums text-muted">≈ {c.price}</p>}
            </>
          )
          return (
            <li key={c.id} className="relative">
              {mode === 'view' || !loggedIn ? (
                <Link href={`/karta/${encodeURIComponent(c.id)}`} className="card-tile group relative block">
                  {tile}
                </Link>
              ) : (
                <button type="button" onClick={() => onCard(c.id)} className="card-tile group relative block w-full text-left">
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
                  className="absolute left-1.5 top-1.5 z-20 grid h-8 w-8 place-items-center rounded-full bg-card text-fg shadow-[0_2px_8px_rgba(14,27,46,0.25)]"
                >
                  <Minus className="h-4 w-4" strokeWidth={2.4} aria-hidden />
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
