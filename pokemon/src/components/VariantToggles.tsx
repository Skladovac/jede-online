'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import type { Variant } from '@prisma/client'
import { toggleVariant } from '@/app/actions/collection'
import { useT } from '@/lib/i18n/client'

type V = { key: Variant; label: string; owned: number }

/**
 * Zaškrtávátka variant na detailu karty: klik = mám / nemám danou variantu (1 kus).
 * Víc kusů, stav nebo jazyk se řeší ve formuláři níže; tady jde o rychlé „mám normál i reverse“.
 */
export function VariantToggles({ cardId, variants, loggedIn }: { cardId: string; variants: V[]; loggedIn: boolean }) {
  const t = useT()
  const router = useRouter()
  const [owned, setOwned] = useState<Record<string, number>>(Object.fromEntries(variants.map((v) => [v.key, v.owned])))
  const [pending, start] = useTransition()

  if (!loggedIn)
    return (
      <>
        {variants.map((v) => (
          <span key={v.key} className="rounded-[7px] bg-surface px-2 py-0.5 text-xs font-semibold text-muted ring-1 ring-inset ring-line">
            {v.label}
          </span>
        ))}
      </>
    )

  const toggle = (v: Variant) => {
    const was = owned[v] ?? 0
    setOwned((o) => ({ ...o, [v]: was ? 0 : 1 }))
    start(async () => {
      try {
        setOwned(await toggleVariant(cardId, v))
        router.refresh()
      } catch {
        setOwned((o) => ({ ...o, [v]: was }))
      }
    })
  }

  return (
    <>
      {variants.map((v) => {
        const n = owned[v.key] ?? 0
        return (
          <button
            key={v.key}
            type="button"
            role="checkbox"
            aria-checked={n > 0}
            disabled={pending}
            onClick={() => toggle(v.key)}
            title={n > 0 ? t('Mám — kliknutím odebereš') : t('Nemám — kliknutím přidáš 1 kus')}
            className={`inline-flex min-h-8 items-center gap-1.5 rounded-[8px] px-2.5 text-xs font-semibold ring-1 ring-inset transition-colors ${
              n > 0
                ? 'bg-[color-mix(in_srgb,var(--positive)_12%,transparent)] text-positive ring-[color-mix(in_srgb,var(--positive)_35%,transparent)]'
                : 'bg-surface text-muted ring-line hover:text-fg'
            }`}
          >
            <span className={`grid h-4 w-4 place-items-center rounded-[4px] ring-1 ring-inset ${n > 0 ? 'bg-positive text-white ring-positive' : 'bg-card ring-line-strong'}`} aria-hidden>
              {n > 0 && <Check className="h-3 w-3" strokeWidth={3} />}
            </span>
            {v.label}
            {n > 1 && <span className="tabular-nums">{n}×</span>}
          </button>
        )
      })}
    </>
  )
}
