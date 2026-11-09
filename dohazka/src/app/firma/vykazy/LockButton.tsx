'use client'

import { useState, useTransition } from 'react'
import { lockPeriod, unlockPeriod } from '@/app/actions/lock'

// Tlačítko jen pohodlí: oprávnění a platnost klíče znovu hlídá akce.
export function LockButton({ period, locked, canUnlock }: { period: string; locked: boolean; canUnlock: boolean }) {
  const [pending, startTransition] = useTransition()
  const [chyba, nastavChybu] = useState<string | null>(null)
  if (locked && !canUnlock) return null

  function klik() {
    const text = locked
      ? 'Otevřít měsíc? Lidé v něm budou zase moct měnit své záznamy.'
      : 'Uzavřít měsíc? Nikdo v něm pak nebude moct záznamy měnit, dokud ho správce neotevře.'
    if (!window.confirm(text)) return
    startTransition(async () => {
      try {
        const r = await (locked ? unlockPeriod(period) : lockPeriod(period))
        nastavChybu('error' in r ? r.error : null)
      } catch {
        nastavChybu('Nepodařilo se. Zkus to znovu.')
      }
    })
  }

  return (
    <div>
      <button
        type="button"
        onClick={klik}
        disabled={pending}
        className="rounded-panel border border-line-strong bg-card px-3 py-2 text-sm font-medium hover:bg-card-hover disabled:opacity-60"
      >
        {locked ? 'Otevřít měsíc' : 'Uzavřít měsíc'}
      </button>
      {chyba && (
        <p role="alert" className="mt-1 text-sm text-danger">
          {chyba}
        </p>
      )}
    </div>
  )
}
