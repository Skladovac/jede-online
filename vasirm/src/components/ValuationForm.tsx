'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { submitValuation, type FormState } from '@/app/actions/leads'
import { BotTrap, Consent, Field, FormError, Submit, Success, TextArea } from '@/components/forms'

const TYPES = ['Byt', 'Rodinný dům', 'Pozemek', 'Chata / chalupa', 'Komerční', 'Jiné']
const CONDITIONS = ['Novostavba', 'Velmi dobrý', 'Dobrý', 'Před rekonstrukcí']
const TIMINGS = ['Co nejdříve', 'Do 3 měsíců', 'Do roka', 'Jen zjišťuji cenu']
const STEPS = ['Nemovitost', 'Detaily', 'Kontakt']

/**
 * Odhad ceny ve třech krocích. Všechna pole jsou v jednom formuláři (kroky se jen skrývají),
 * takže bez JavaScriptu je vidět celý formulář najednou a jde normálně odeslat.
 */
export function ValuationForm() {
  const [state, action] = useActionState<FormState, FormData>(submitValuation, {})
  const [mounted, setMounted] = useState(false)
  const [step, setStep] = useState(0)
  const [type, setType] = useState('')
  const [stepError, setStepError] = useState('')
  const formRef = useRef<HTMLFormElement>(null)
  const topRef = useRef<HTMLDivElement>(null)

  useEffect(() => setMounted(true), [])
  // Chyba ze serveru u kontaktu nebo lokality → ukázat příslušný krok.
  useEffect(() => {
    if (state.fields?.locality) setStep(1)
    else if (state.error) setStep(2)
    if (state.values?.propertyType) setType(state.values.propertyType)
  }, [state])

  if (state.ok) {
    return (
      <Success title="Děkujeme!">
        Poptávku odhadu máme. Ozveme se vám co nejdříve a domluvíme se na dalším postupu.
      </Success>
    )
  }

  const hasLand = ['Rodinný dům', 'Pozemek', 'Chata / chalupa', 'Komerční', 'Jiné'].includes(type)
  const hasRooms = ['Byt', 'Rodinný dům', 'Chata / chalupa'].includes(type)

  const next = () => {
    const form = formRef.current
    if (!form) return
    if (step === 0 && !type) return setStepError('Vyberte prosím, o jakou nemovitost jde.')
    if (step === 1 && !String(new FormData(form).get('locality') ?? '').trim()) return setStepError('Doplňte prosím, kde nemovitost je.')
    setStepError('')
    setStep((s) => Math.min(2, s + 1))
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  const show = (i: number) => !mounted || step === i

  return (
    <form ref={formRef} action={action} noValidate className="relative">
      <BotTrap />
      <div ref={topRef} className="scroll-mt-28" />

      {mounted && (
        <ol className="mb-8 grid grid-cols-3 gap-2" aria-label="Kroky formuláře">
          {STEPS.map((s, i) => (
            <li key={s} aria-current={i === step ? 'step' : undefined}>
              <div className={`h-[3px] transition-colors duration-500 ${i <= step ? 'bg-gold' : 'bg-ink/10'}`} />
              <p className={`mt-2 text-xs font-semibold uppercase tracking-[0.14em] ${i === step ? 'text-ink' : 'text-stone-light'}`}>
                {i + 1}. {s}
              </p>
            </li>
          ))}
        </ol>
      )}

      {/* Krok 1 — typ */}
      <fieldset hidden={!show(0)} className="space-y-5">
        <legend className="font-serif text-3xl">Co chcete ocenit?</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {TYPES.map((t) => (
            <label
              key={t}
              className={`flex min-h-[3.5rem] cursor-pointer items-center justify-center border px-3 text-center text-[0.95rem] font-medium transition ${
                type === t ? 'border-gold bg-gold/15 text-ink' : 'border-ink/15 bg-white hover:border-ink/40'
              }`}
            >
              <input
                type="radio"
                name="propertyType"
                value={t}
                checked={type === t}
                onChange={() => {
                  setType(t)
                  setStepError('')
                }}
                className="sr-only"
              />
              {t}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Krok 2 — detaily */}
      <fieldset hidden={!show(1)} className={`space-y-5 ${!mounted ? 'mt-10' : ''}`}>
        <legend className="font-serif text-3xl">Kde je a jak je velká?</legend>
        <Field label="Obec nebo část obce" name="locality" state={state} placeholder="např. Zlín – Jižní Svahy" autoComplete="address-level2" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Užitná plocha (m²)" name="area" state={state} inputMode="numeric" placeholder="např. 85" />
          {(!mounted || hasLand) && <Field label="Pozemek (m²)" name="landArea" state={state} inputMode="numeric" placeholder="nepovinné" />}
          {(!mounted || hasRooms) && <Field label="Dispozice" name="disposition" state={state} placeholder="např. 3+1" />}
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-ink/80">Stav nemovitosti</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {CONDITIONS.map((c) => (
              <label key={c} className="cursor-pointer">
                <input type="radio" name="condition" value={c} defaultChecked={state.values?.condition === c} className="peer sr-only" />
                <span className="flex min-h-[3rem] items-center justify-center border border-ink/15 bg-white px-2 text-center text-sm transition hover:border-ink/40 peer-checked:border-gold peer-checked:bg-gold/15 peer-focus-visible:ring-2 peer-focus-visible:ring-gold">
                  {c}
                </span>
              </label>
            ))}
          </div>
        </div>
      </fieldset>

      {/* Krok 3 — kontakt */}
      <fieldset hidden={!show(2)} className={`space-y-5 ${!mounted ? 'mt-10' : ''}`}>
        <legend className="font-serif text-3xl">Kam vám máme odhad poslat?</legend>
        <div>
          <p className="mb-2 text-sm font-medium text-ink/80">Kdy plánujete prodej?</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TIMINGS.map((c) => (
              <label key={c} className="cursor-pointer">
                <input type="radio" name="timing" value={c} defaultChecked={state.values?.timing === c} className="peer sr-only" />
                <span className="flex min-h-[3rem] items-center justify-center border border-ink/15 bg-white px-2 text-center text-sm transition hover:border-ink/40 peer-checked:border-gold peer-checked:bg-gold/15 peer-focus-visible:ring-2 peer-focus-visible:ring-gold">
                  {c}
                </span>
              </label>
            ))}
          </div>
        </div>
        <Field label="Jméno a příjmení" name="name" state={state} autoComplete="name" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Telefon" name="phone" state={state} type="tel" autoComplete="tel" inputMode="tel" />
          <Field label="E-mail" name="email" state={state} type="email" autoComplete="email" />
        </div>
        <TextArea label="Cokoliv dalšího (nepovinné)" name="message" state={state} rows={3} placeholder="Např. rok rekonstrukce, garáž, kdy se můžeme podívat…" />
        <Consent state={state} />
      </fieldset>

      <div className="mt-8 space-y-4">
        {stepError && (
          <p role="alert" className="border-l-2 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-700">
            {stepError}
          </p>
        )}
        <FormError state={state} />
        {mounted && step < 2 ? (
          <div className="flex gap-3">
            {step > 0 && (
              <button type="button" onClick={() => setStep((s) => s - 1)} className="btn-ghost-dark px-4" aria-label="Zpět">
                <ArrowLeft className="h-4 w-4" aria-hidden />
              </button>
            )}
            <button type="button" onClick={next} className="btn-ink flex-1">
              Pokračovat <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ) : (
          <div className="flex gap-3">
            {mounted && (
              <button type="button" onClick={() => setStep(1)} className="btn-ghost-dark px-4" aria-label="Zpět">
                <ArrowLeft className="h-4 w-4" aria-hidden />
              </button>
            )}
            <Submit className="btn-gold flex-1">Odeslat a získat odhad zdarma</Submit>
          </div>
        )}
      </div>
    </form>
  )
}
