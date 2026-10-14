'use client'

import { startTransition, useActionState } from 'react'
import { Check, Loader2, Trash2 } from 'lucide-react'
import { deleteTestimonial, saveTeam, saveTestimonial, type AdminState } from '@/app/actions/admin'

function Result({ state }: { state: AdminState }) {
  if (state.error) return <p className="border-l-2 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</p>
  if (state.ok)
    return (
      <p className="flex items-center gap-1.5 text-sm text-emerald-800">
        <Check className="h-4 w-4" aria-hidden /> {state.message}
      </p>
    )
  return null
}

/** Odeslání bez vymazání formuláře při chybě. */
function useKeepForm(fn: (prev: AdminState, fd: FormData) => Promise<AdminState>) {
  const [state, action, pending] = useActionState<AdminState, FormData>(fn, {})
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(() => action(fd))
  }
  return { state, pending, onSubmit }
}

function Save({ pending, label = 'Uložit' }: { pending: boolean; label?: string }) {
  return (
    <button type="submit" disabled={pending} className="btn-ink disabled:opacity-70">
      {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} {label}
    </button>
  )
}

export function TeamForm({ team }: { team: { yearsInField: number | null; soldCount: number | null; avgSaleDays: number | null; story: string } }) {
  const { state, pending, onSubmit } = useKeepForm(saveTeam)
  return (
    <form onSubmit={onSubmit} className="mt-5 space-y-5">
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Čísla na úvodní stránce</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-xs text-stone">Let v realitách</span>
            <input name="yearsInField" inputMode="numeric" defaultValue={team.yearsInField ?? ''} className="field" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-stone">Prodaných nemovitostí (celkem)</span>
            <input name="soldCount" inputMode="numeric" defaultValue={team.soldCount ?? ''} className="field" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-stone">Průměrně dní do prodeje</span>
            <input name="avgSaleDays" inputMode="numeric" defaultValue={team.avgSaleDays ?? ''} className="field" />
          </label>
        </div>
        <span className="mt-1.5 block text-xs text-stone">Prázdné se neukáže. Pás s čísly pod úvodní fotkou se zobrazí, až budou vyplněná aspoň dvě.</span>
      </fieldset>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Náš společný příběh (stránka O nás)</span>
        <textarea
          name="story"
          defaultValue={team.story}
          rows={10}
          className="field leading-relaxed"
          placeholder="Prázdné = použije se dosavadní text („Nejsme velká korporace…“). Odstavce oddělte prázdným řádkem."
        />
      </label>
      <div className="flex flex-wrap items-center gap-4">
        <Save pending={pending} />
        <Result state={state} />
      </div>
    </form>
  )
}

type T = {
  id: string
  quote: string
  clientName: string
  clientPlace: string
  propertyLabel: string
  agentId: string | null
  listingId: string | null
  consent: boolean
  published: boolean
  sort: number
}

export function TestimonialForm({
  t,
  agents,
  listings,
}: {
  t: T | null
  agents: { id: string; name: string }[]
  listings: { id: string; title: string; locality: string }[]
}) {
  const { state, pending, onSubmit } = useKeepForm(saveTestimonial.bind(null, t?.id ?? null))
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Co klient říká</span>
        <textarea name="quote" defaultValue={t?.quote} rows={5} maxLength={1200} className="field leading-relaxed" placeholder="Přesná slova klienta, bez úprav smyslu." />
      </label>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Jméno klienta</span>
          <input name="clientName" defaultValue={t?.clientName} placeholder="Jana K." className="field" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Obec</span>
          <input name="clientPlace" defaultValue={t?.clientPlace} placeholder="Zlín" className="field" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Co řešil</span>
          <input name="propertyLabel" defaultValue={t?.propertyLabel} placeholder="Prodej rodinného domu" className="field" />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Makléř</span>
          <select name="agentId" defaultValue={t?.agentId ?? ''} className="field">
            <option value="">—</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Nemovitost (fotka k referenci)</span>
          <select name="listingId" defaultValue={t?.listingId ?? ''} className="field">
            <option value="">— bez fotky —</option>
            {listings.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}, {l.locality}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="space-y-3 border-t border-ink/10 pt-5">
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="consent" defaultChecked={t?.consent} className="mt-0.5 h-4 w-4 accent-[#c5a880]" />
          <span>
            <strong>Klient souhlasí se zveřejněním</strong> své reference na webu (ideálně písemně, např. e-mailem — schovejte si ho).
          </span>
        </label>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" name="published" defaultChecked={t?.published} className="h-4 w-4 accent-[#c5a880]" />
          Zveřejnit na webu
        </label>
        <label className="flex items-center gap-3 text-sm">
          Pořadí
          <input name="sort" inputMode="numeric" defaultValue={t?.sort ?? 0} className="field w-24" />
          <span className="text-xs text-stone">menší číslo = výš</span>
        </label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <Save pending={pending} label={t ? 'Uložit' : 'Přidat referenci'} />
          <Result state={state} />
        </div>
        {t && (
          <button
            type="button"
            onClick={async () => {
              if (confirm('Smazat referenci?')) await deleteTestimonial(t.id)
            }}
            className="inline-flex items-center gap-2 text-sm text-red-700 hover:underline"
          >
            <Trash2 className="h-4 w-4" aria-hidden /> Smazat
          </button>
        )}
      </div>
    </form>
  )
}
