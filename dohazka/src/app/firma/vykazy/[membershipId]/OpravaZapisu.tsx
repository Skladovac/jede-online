'use client'

import { useRef, useState, useTransition } from 'react'
import { deleteEntryFor, saveEntryFor } from '@/app/actions/entry'

// Jen pohodlí: oprávnění, uzávěrku i příslušnost člena k firmě znovu hlídají akce.
export function SmazatZapis({ membershipId, id, popis }: { membershipId: string; id: string; popis: string }) {
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
      <button type="button" onClick={klik} disabled={pending} aria-label={`Smazat záznam: ${popis}`} className="text-xs text-danger underline disabled:opacity-60">
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
  const formRef = useRef<HTMLFormElement>(null)
  const [pending, startTransition] = useTransition()
  const [chyba, nastavChybu] = useState<string | null>(null)
  const [ulozeno, nastavUlozeno] = useState(false)

  // Záměrně onSubmit, ne `action`: React 19 po akci formulář vyresetuje i při chybě a správce by přišel o vyplněné hodnoty.
  function odeslat(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      nastavUlozeno(false)
      try {
        const r = await saveEntryFor(membershipId, fd)
        nastavChybu('error' in r ? r.error : null)
        if ('ok' in r) {
          formRef.current?.reset()
          nastavUlozeno(true)
        }
      } catch {
        nastavChybu('Nepodařilo se. Zkus to znovu.')
      }
    })
  }

  const pole = 'mt-1 w-full rounded-panel border border-line-strong bg-card px-2 py-1.5 text-sm'
  return (
    <details className="mt-5 rounded-panel border border-line bg-card px-3 py-3">
      <summary className="cursor-pointer text-sm font-medium">Přidat záznam</summary>
      <p className="mt-2 text-sm text-muted">Špatný záznam nejdřív smaž, pak zapiš správný. Oboje se uloží do historie změn.</p>
      <form ref={formRef} onSubmit={odeslat} className="mt-3 space-y-2">
        <label className="block text-sm">
          Den
          <input name="day" type="date" required className={pole} />
        </label>
        <label className="block text-sm">
          Typ dne
          <select name="kind" className={pole} defaultValue="WORK">
            <option value="WORK">Práce</option>
            <option value="VACATION">Dovolená</option>
            <option value="SICK">Nemoc</option>
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-sm">
            Od
            <input name="fromTime" type="time" autoComplete="off" className={pole} />
          </label>
          <label className="block text-sm">
            Do
            <input name="toTime" type="time" autoComplete="off" className={pole} />
          </label>
        </div>
        <label className="block text-sm">
          Hodiny
          <input name="hours" inputMode="decimal" autoComplete="off" className={pole} />
        </label>
        <label className="block text-sm">
          Místo (u práce)
          <input name="place" autoComplete="off" maxLength={200} className={pole} />
        </label>
        <label className="block text-sm">
          Poznámka
          <input name="note" autoComplete="off" maxLength={500} className={pole} />
        </label>
        <button type="submit" disabled={pending} className="rounded-panel border border-line-strong px-3 py-2 text-sm font-medium disabled:opacity-60">
          Uložit
        </button>
        {ulozeno && !chyba && (
          <p role="status" className="text-sm text-muted">
            Záznam je uložený.
          </p>
        )}
        {chyba && (
          <p role="alert" className="text-sm text-danger">
            {chyba}
          </p>
        )}
      </form>
    </details>
  )
}
