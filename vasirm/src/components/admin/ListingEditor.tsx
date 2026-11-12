'use client'

import { startTransition, useActionState, useEffect, useState } from 'react'
import { AlertTriangle, Check, Loader2, Plus, Trash2, X } from 'lucide-react'
import type { ListingStatus, OfferType, PropertyType } from '@prisma/client'
import { deleteListing, saveListing, type AdminState } from '@/app/actions/admin'
import { ENERGY_CLASSES, ENERGY_LABEL } from '@/lib/format'
import { OFFER_LABEL, STATUS_LABEL, TYPE_LABEL } from '@/lib/labels'

type Data = {
  id: string
  title: string
  slug: string
  status: ListingStatus
  offerType: OfferType
  propertyType: PropertyType
  locality: string
  mapQuery: string
  price: number | null
  priceNote: string
  usableArea: number | null
  landArea: number | null
  disposition: string
  energyClass: string | null
  perex: string
  description: string
  params: { label: string; value: string }[]
  videoUrl: string | null
  agentId: string | null
  featured: boolean
}

const SUGGESTED = ['Stav', 'Rok výstavby', 'Vytápění', 'Okna', 'Parkování', 'Sítě', 'Vlastnictví', 'Podlaží', 'Výtah', 'Sklep', 'Balkon / terasa']

export function ListingEditor({ listing: l, agents }: { listing: Data; agents: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<AdminState, FormData>(saveListing.bind(null, l.id), {})
  const [params, setParams] = useState(l.params.length ? l.params : [{ label: '', value: '' }])
  const [status, setStatus] = useState(l.status)
  const [energy, setEnergy] = useState(l.energyClass ?? '')
  // Adresu může po uložení změnit server (z konceptu, kolize) — pole drží aktuální hodnotu z databáze.
  const [slug, setSlug] = useState(l.slug)
  useEffect(() => setSlug(l.slug), [l.slug])

  return (
    // onSubmit místo action={…}: React by po odeslání formulář vymazal i při chybě a rozepsané změny by zmizely.
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        startTransition(() => action(fd))
      }}
      className="mt-6 space-y-6 pb-28"
    >
      <Card title="Základní údaje">
        <Grid>
          <L label="Název" className="sm:col-span-2" hint="Např. „Rodinný dům 4+1 se zahradou“. Lokalita se ukáže zvlášť.">
            <input name="title" defaultValue={l.title} required className="field" />
          </L>
          <L label="Stav na webu">
            <select name="status" value={status} onChange={(e) => setStatus(e.target.value as ListingStatus)} className="field">
              {(Object.keys(STATUS_LABEL) as ListingStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                  {s === 'DRAFT' ? ' (není vidět)' : ''}
                </option>
              ))}
            </select>
          </L>
          <L label="Makléř">
            <select name="agentId" defaultValue={l.agentId ?? ''} className="field">
              <option value="">—</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </L>
          <L label="Typ nabídky">
            <select name="offerType" defaultValue={l.offerType} className="field">
              {(Object.keys(OFFER_LABEL) as OfferType[]).map((o) => (
                <option key={o} value={o}>
                  {OFFER_LABEL[o]}
                </option>
              ))}
            </select>
          </L>
          <L label="Druh nemovitosti">
            <select name="propertyType" defaultValue={l.propertyType} className="field">
              {(Object.keys(TYPE_LABEL) as PropertyType[]).map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </L>
          <label className="flex items-center gap-3 text-sm sm:col-span-2">
            <input type="checkbox" name="featured" defaultChecked={l.featured} className="h-4 w-4 accent-[#c5a880]" />
            Zvýraznit (zobrazit na úvodní stránce jako první)
          </label>
        </Grid>
      </Card>

      <Card title="Lokalita a cena">
        <Grid>
          <L label="Lokalita" hint="Obec, případně část obce: „Zlín – Chlum“.">
            <input name="locality" defaultValue={l.locality} className="field" />
          </L>
          <L label="Pro mapu" hint="Co hledat v mapě, bez přesné adresy: „Chlum, Zlín“. Prázdné = bez mapy.">
            <input name="mapQuery" defaultValue={l.mapQuery} className="field" />
          </L>
          <L label="Cena (Kč)" hint="Prázdné = „Cena na vyžádání“. U pronájmu měsíční nájem.">
            <input name="price" defaultValue={l.price ?? ''} inputMode="numeric" className="field tabular-nums" />
          </L>
          <L label="Poznámka k ceně" hint="Např. „včetně provize“, „+ energie“.">
            <input name="priceNote" defaultValue={l.priceNote} className="field" />
          </L>
        </Grid>
      </Card>

      <Card title="Parametry">
        <Grid cols={4}>
          <L label="Užitná plocha (m²)">
            <input name="usableArea" defaultValue={l.usableArea ?? ''} inputMode="numeric" className="field" />
          </L>
          <L label="Pozemek (m²)">
            <input name="landArea" defaultValue={l.landArea ?? ''} inputMode="numeric" className="field" />
          </L>
          <L label="Dispozice">
            <input name="disposition" defaultValue={l.disposition} placeholder="3+kk" className="field" />
          </L>
          <L label="Energetická třída">
            <select name="energyClass" value={energy} onChange={(e) => setEnergy(e.target.value)} className="field">
              <option value="">neuvedeno</option>
              {ENERGY_CLASSES.map((c) => (
                <option key={c} value={c}>
                  {c} – {ENERGY_LABEL[c]}
                </option>
              ))}
            </select>
          </L>
        </Grid>
        {!energy && status !== 'DRAFT' && (
          <p className="mt-4 flex items-start gap-2 border-l-2 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            Třída energetické náročnosti je v inzerci povinná. Když průkaz (PENB) chybí, uvádí se třída G.
          </p>
        )}

        <div className="mt-6">
          <p className="mb-2 text-sm font-medium">Další parametry</p>
          <div className="space-y-2">
            {params.map((p, i) => (
              <div key={i} className="flex gap-2">
                <input
                  name="paramLabel"
                  value={p.label}
                  onChange={(e) => setParams((ps) => ps.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                  list="param-suggest"
                  placeholder="Název (např. Vytápění)"
                  className="field w-2/5"
                />
                <input
                  name="paramValue"
                  value={p.value}
                  onChange={(e) => setParams((ps) => ps.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
                  placeholder="Hodnota"
                  className="field flex-1"
                />
                <button
                  type="button"
                  onClick={() => setParams((ps) => ps.filter((_, j) => j !== i))}
                  className="grid w-11 shrink-0 place-items-center border border-ink/15 text-stone hover:border-red-400 hover:text-red-600"
                  aria-label="Odebrat parametr"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <datalist id="param-suggest">
            {SUGGESTED.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <button type="button" onClick={() => setParams((ps) => [...ps, { label: '', value: '' }])} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold hover:text-gold-deep">
            <Plus className="h-4 w-4" aria-hidden /> Přidat parametr
          </button>
        </div>
      </Card>

      <Card title="Texty">
        <L label="Krátký úvod" hint="1–2 věty, zobrazí se velkým písmem nad popisem a ve výsledcích vyhledávání.">
          <textarea name="perex" defaultValue={l.perex} rows={2} maxLength={400} className="field" />
        </L>
        <L label="Popis" className="mt-5" hint="Odstavce oddělte prázdným řádkem.">
          <textarea name="description" defaultValue={l.description} rows={16} className="field font-[inherit] leading-relaxed" />
        </L>
      </Card>

      <Card title="Video z YouTube / Vimea (nepovinné)">
        <L label="Odkaz na video" hint="Když nahrajete video výše přímo na web, má přednost.">
          <input name="videoUrl" defaultValue={l.videoUrl ?? ''} placeholder="https://www.youtube.com/watch?v=…" className="field" />
        </L>
      </Card>

      <Card title="Adresa stránky">
        <L label="Konec adresy" hint="Prázdné = vytvoří se z názvu a lokality. Změna adresy rozbije odkazy, které už někdo sdílel.">
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-sm text-stone">/nabidka/</span>
            <input name="slug" value={slug} onChange={(e) => setSlug(e.target.value)} className="field" />
          </div>
        </L>
      </Card>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={async () => {
            if (confirm('Opravdu smazat tuto nemovitost včetně všech fotek? Nejde to vrátit.')) await deleteListing(l.id)
          }}
          className="inline-flex items-center gap-2 text-sm text-red-700 hover:underline"
        >
          <Trash2 className="h-4 w-4" aria-hidden /> Smazat nemovitost
        </button>
      </div>

      {/* Lišta s uložením — pořád po ruce */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink/10 bg-white/95 backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-10">
          <p className="text-sm" role="status">
            {state.error ? (
              <span className="text-red-700">{state.error}</span>
            ) : state.ok ? (
              <span className="flex items-center gap-1.5 text-emerald-800">
                <Check className="h-4 w-4" aria-hidden /> {state.message}
              </span>
            ) : (
              <span className="text-stone">Změny se projeví po uložení.</span>
            )}
          </p>
          <button type="submit" disabled={pending} className="btn-ink shrink-0 disabled:opacity-70">
            {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {pending ? 'Ukládám…' : 'Uložit'}
          </button>
        </div>
      </div>
    </form>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-ink/10 bg-white p-5 sm:p-7">
      <h2 className="mb-5 font-serif text-2xl">{title}</h2>
      {children}
    </section>
  )
}

function Grid({ children, cols = 2 }: { children: React.ReactNode; cols?: 2 | 4 }) {
  return <div className={`grid gap-5 ${cols === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2'}`}>{children}</div>
}

function L({ label, hint, children, className = '' }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-stone">{hint}</span>}
    </label>
  )
}
