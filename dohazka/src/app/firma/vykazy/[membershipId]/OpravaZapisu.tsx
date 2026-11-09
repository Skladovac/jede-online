'use client'

import { useState, useTransition } from 'react'
import { deleteEntryFor, saveEntryFor } from '@/app/actions/entry'

// Jen pohodlí: oprávnění, uzávěrku i příslušnost člena k firmě znovu hlídají akce.
export function SmazatZapis({ membershipId, id }: { membershipId: string; id: string }) {
  const [pending, startTransition] = useTransition()
  const [chyba, nastavChybu] = useState<string | null>(null)

  function klik() {
    if (!window.confirm('Smazat tento záznam? Změna se zapíše do historie.')) return
    startTransition(async () => {
      try {
        const r = await deleteEntryFor(membershipId, id)
        nastavChybu('error' in r ? r.error : null)
      } catch {
        nastavChybu('Nepodařilo se. Zkus to znovu.')
      }
    })
  }

  return (
    <span className="shrink-0">
      <button type="button" onClick={klik} disabled={pending} className="text-xs text-danger underline disabled:opacity-60">
        Smazat
      </button>
      {chyba && (
        <span role="alert" className="block text-xs text-danger">
          {chyba}
        </span>
      )}
    </span>
  )
}

export function PridatZapis({ membershipId }: { membershipId: string }) {
  const [pending, startTransition] = useTransition()
  const [chyba, nastavChybu] = useState<string | null>(null)

  function odeslat(formData: FormData) {
    startTransition(async () => {
      try {
        const r = await saveEntryFor(membershipId, formData)
        nastavChybu('error' in r ? r.error : null)
      } catch {
        nastavChybu('Nepodařilo se. Zkus to znovu.')
      }
    })
  }

  const pole = 'w-full rounded-panel border border-line-strong bg-card px-2 py-1.5 text-sm'
  return (
    <details className="mt-5 rounded-panel border border-line bg-card px-3 py-3">
      <summary className="cursor-pointer text-sm font-medium">Přidat nebo opravit záznam</summary>
      <form action={odeslat} className="mt-3 space-y-2">
        <input name="day" type="date" required className={pole} aria-label="Den" />
        <select name="kind" className={pole} aria-label="Typ dne" defaultValue="WORK">
          <option value="WORK">Práce</option>
          <option value="VACATION">Dovolená</option>
          <option value="SICK">Nemoc</option>
        </select>
        <input name="hours" inputMode="decimal" placeholder="Hodiny" className={pole} aria-label="Hodiny" />
        <input name="place" placeholder="Místo (u práce)" className={pole} aria-label="Místo" />
        <input name="note" placeholder="Poznámka" className={pole} aria-label="Poznámka" />
        <button type="submit" disabled={pending} className="rounded-panel border border-line-strong px-3 py-2 text-sm font-medium disabled:opacity-60">
          Uložit
        </button>
        {chyba && (
          <p role="alert" className="text-sm text-danger">
            {chyba}
          </p>
        )}
      </form>
    </details>
  )
}
