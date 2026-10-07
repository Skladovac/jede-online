'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { changeSpare, toggleOwned, toggleWant, type QuickState } from '@/app/actions/collection'

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
}: {
  cards: GridCard[]
  initial: Record<string, QuickState>
  loggedIn: boolean
  officialCount: number
}) {
  const [mode, setMode] = useState<Mode>('view')
  const [state, setState] = useState(initial)
  const [, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const ownedCount = cards.filter((c) => (state[c.id]?.owned ?? 0) > 0).length
  const wantCount = cards.filter((c) => state[c.id]?.want).length
  const spareCount = cards.reduce((s, c) => s + (state[c.id]?.spare ?? 0), 0)

  function apply(cardId: string, optimistic: QuickState, call: () => Promise<QuickState>) {
    setState((s) => ({ ...s, [cardId]: optimistic }))
    startTransition(async () => {
      try {
        const real = await call()
        setState((s) => ({ ...s, [cardId]: real }))
        setError(null)
      } catch {
        setState((s) => ({ ...s, [cardId]: initial[cardId] ?? { owned: 0, spare: 0, want: false } }))
        setError('Uložení se nepovedlo. Jsi přihlášený?')
      }
    })
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
                {m.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">{MODES.find((m) => m.id === mode)!.hint}</p>
          <div className="mt-2 flex items-center gap-3 text-xs">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-green-500 transition-all"
                style={{ width: `${Math.min(100, (ownedCount / Math.max(officialCount, 1)) * 100)}%` }}
              />
            </div>
            <span className="shrink-0 font-medium">
              Mám {ownedCount}/{officialCount} · chybí {wantCount} · navíc {spareCount}
            </span>
          </div>
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </div>
      ) : (
        <p className="rounded-xl bg-yellow-50 px-4 py-3 text-sm text-yellow-900 dark:bg-yellow-400/10 dark:text-yellow-100">
          <Link href="/prihlaseni" className="font-semibold underline">
            Přihlas se
          </Link>{' '}
          a odklikávej si, které karty máš, které ti chybí a které máš navíc.
        </p>
      )}

      <ul className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {cards.map((c) => {
          const s = state[c.id] ?? { owned: 0, spare: 0, want: false }
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
                  <img src={c.image} alt={c.name} loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center p-2 text-center text-xs text-slate-500">{c.name}</div>
                )}
                <div className="absolute left-1 top-1 flex flex-col gap-1">
                  {s.owned > 0 && <Badge className="bg-green-600">✓ {s.owned > 1 ? s.owned : ''}</Badge>}
                  {s.want && <Badge className="bg-orange-500">chybí</Badge>}
                  {s.spare > 0 && <Badge className="bg-blue-600">+{s.spare} navíc</Badge>}
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
                  aria-label="Ubrat kus navíc"
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
