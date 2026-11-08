'use client'

import { useRef, useState, useTransition } from 'react'
import { deleteEntry, markDayOff, saveEntry } from '@/app/actions/entry'
import { formatHours } from '@/lib/date'
import { hoursFromRange } from '@/lib/entry'

const pole = 'mt-1 w-full rounded-panel border border-line bg-card px-3 py-2 text-fg focus:border-line-strong focus:outline-none'

type Stav = { error: string } | { ok: true } | null

export function DayForm({ day, places, hasEntries }: { day: string; places: string[]; hasEntries: boolean }) {
  const formRef = useRef<HTMLFormElement>(null)
  const hoursRef = useRef<HTMLInputElement>(null)
  const fromRef = useRef<HTMLInputElement>(null)
  const toRef = useRef<HTMLInputElement>(null)
  // Poslední hodnota, kterou do hodin vložil formulář sám. Dokud v poli zůstává přesně ona, smí se přepsat
  // (uživatel změnil čas); jakmile ji uživatel upraví, hodiny jsou jeho a už na ně nesahám.
  const automaticke = useRef('')
  const [pending, startTransition] = useTransition()

  const [stav, nastavStav] = useState<Stav>(null)

  // Záměrně onSubmit, ne `action`: React 19 po akci formulář vždy vyresetuje, tedy i při chybě,
  // a uživatel by o vyplněné hodnoty přišel. Resetujeme sami, až po úspěšném zápisu.
  function odeslat(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = await saveEntry(fd)
      nastavStav(r)
      if ('ok' in r) {
        formRef.current?.reset()
        automaticke.current = ''
        // Pole hodin je hned připravené na další záznam.
        hoursRef.current?.focus()
      }
    })
  }

  function predvyplnHodiny() {
    const hours = hoursRef.current
    if (!hours || !fromRef.current || !toRef.current) return
    if (hours.value !== '' && hours.value !== automaticke.current) return
    const h = hoursFromRange(fromRef.current.value, toRef.current.value)
    if (h === null) return
    automaticke.current = formatHours(h)
    hours.value = automaticke.current
  }

  function nepracoval() {
    if (hasEntries && !window.confirm('Smazat dnešní záznamy a zapsat „Nepracoval“?')) return
    startTransition(async () => {
      await markDayOff(day)
    })
  }

  return (
    <form ref={formRef} onSubmit={odeslat} className="mt-5 space-y-4">
      <input type="hidden" name="day" value={day} />

      <label className="block text-sm font-medium">
        Hodiny
        <input
          ref={hoursRef}
          name="hours"
          inputMode="decimal"
          autoComplete="off"
          placeholder="8"
          className={`${pole} py-3 text-center text-3xl font-semibold`}
        />
      </label>

      <label className="block text-sm font-medium">
        Místo
        <input name="place" list="mista" autoComplete="off" maxLength={200} className={pole} />
        <datalist id="mista">
          {places.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </label>

      <details className="rounded-panel border border-line px-3 py-2">
        <summary className="cursor-pointer text-sm text-muted">Další údaje (od–do, typ dne, poznámka)</summary>
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              Od
              <input ref={fromRef} name="fromTime" inputMode="numeric" placeholder="7:00" autoComplete="off" onChange={predvyplnHodiny} className={pole} />
            </label>
            <label className="block text-sm">
              Do
              <input ref={toRef} name="toTime" inputMode="numeric" placeholder="15:30" autoComplete="off" onChange={predvyplnHodiny} className={pole} />
            </label>
          </div>
          <label className="block text-sm">
            Typ dne
            <select name="kind" defaultValue="WORK" className={pole}>
              <option value="WORK">Práce</option>
              <option value="VACATION">Dovolená</option>
              <option value="SICK">Nemoc</option>
              <option value="DAYOFF">Nepracoval</option>
            </select>
          </label>
          <label className="block text-sm">
            Poznámka
            <input name="note" maxLength={500} autoComplete="off" className={pole} />
          </label>
          <p className="text-xs text-muted">Druhý záznam téhož dne přidáte dalším uložením.</p>
        </div>
      </details>

      {stav && 'error' in stav && (
        <p role="alert" className="text-sm text-red-600">
          {stav.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-panel bg-accent px-5 py-3 font-medium text-on-accent hover:bg-accent-hover disabled:opacity-60"
        >
          {pending ? 'Ukládám…' : 'Uložit'}
        </button>
        <button
          type="button"
          onClick={nepracoval}
          disabled={pending}
          className="px-2 py-3 text-sm text-muted underline hover:text-fg disabled:opacity-60"
        >
          Nepracoval
        </button>
      </div>
    </form>
  )
}

export function DeleteEntryButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition()
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!window.confirm('Smazat tento záznam?')) return
        startTransition(async () => {
          await deleteEntry(id)
        })
      }}
      className="shrink-0 rounded-panel border border-line px-3 py-1.5 text-sm text-muted hover:border-line-strong hover:text-fg disabled:opacity-60"
    >
      Smazat
    </button>
  )
}
