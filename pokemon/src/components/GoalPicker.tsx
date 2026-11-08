'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n/client'
import { chooseGoal } from '@/app/actions/goal'
import { GOAL_HINT, GOAL_LABEL, GOALS, type Goal } from '@/lib/goal'

/** Stránka sady: co sbírám (base / complete / master). Podle volby se počítá hlavní číslo, „chybí“ i oslava. */
export function GoalPicker({ setId, goal, hasBase }: { setId: string; goal: Goal; hasBase: boolean }) {
  const t = useT()
  const router = useRouter()
  const [current, setCurrent] = useState(goal)
  const [pending, start] = useTransition()
  const options = GOALS.filter((g) => g !== 'base' || hasBase)

  function pick(g: Goal) {
    if (g === current) return
    setCurrent(g)
    start(async () => {
      await chooseGoal(setId, g)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted">{t('Sbírám:')}</span>
      <div role="radiogroup" aria-label={t('Co sbírám')} className="inline-flex gap-1 rounded-xl bg-surface p-1 ring-1 ring-inset ring-line">
        {options.map((g) => (
          <button
            key={g}
            type="button"
            role="radio"
            aria-checked={current === g}
            disabled={pending}
            onClick={() => pick(g)}
            title={t(GOAL_HINT[g])}
            className={`min-h-9 rounded-[9px] px-3.5 font-semibold transition ${current === g ? 'bg-card text-fg shadow-soft ring-1 ring-inset ring-line' : 'text-muted hover:text-fg'}`}
          >
            {GOAL_LABEL[g]}
          </button>
        ))}
      </div>
      <span className="text-xs text-subtle">{t(GOAL_HINT[current])}</span>
    </div>
  )
}
