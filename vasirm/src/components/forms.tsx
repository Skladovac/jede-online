'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Check, Loader2 } from 'lucide-react'
import type { FormState } from '@/app/actions/leads'

/** Skrytá pole proti robotům: past „web“ a čas načtení formuláře. */
export function BotTrap() {
  const [ts, setTs] = useState('')
  useEffect(() => setTs(String(Date.now())), [])
  return (
    <>
      <input type="hidden" name="ts" value={ts} />
      <div aria-hidden className="absolute left-[-9999px] h-px w-px overflow-hidden">
        <label>
          Nevyplňujte <input type="text" name="web" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
    </>
  )
}

export function Field({
  label,
  name,
  state,
  dark = false,
  hint,
  className = '',
  ...input
}: {
  label: string
  name: string
  state: FormState
  dark?: boolean
  hint?: string
  className?: string
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const err = state.fields?.[name]
  const id = `f-${name}`
  return (
    <div className={className}>
      <label htmlFor={id} className={`mb-1.5 block text-sm font-medium ${dark ? 'text-paper/80' : 'text-ink/80'}`}>
        {label}
      </label>
      <input
        id={id}
        name={name}
        aria-invalid={err ? true : undefined}
        aria-describedby={err ? `${id}-err` : undefined}
        className={`${dark ? 'field-dark' : 'field'} ${err ? '!border-red-500' : ''}`}
        {...input}
        defaultValue={state.values?.[name] ?? input.defaultValue}
      />
      {err ? (
        <p id={`${id}-err`} className="mt-1.5 text-sm text-red-600">
          {err}
        </p>
      ) : (
        hint && <p className={`mt-1.5 text-xs ${dark ? 'text-paper/45' : 'text-stone'}`}>{hint}</p>
      )}
    </div>
  )
}

export function TextArea({
  label,
  name,
  state,
  dark = false,
  className = '',
  ...rest
}: { label: string; name: string; state: FormState; dark?: boolean; className?: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const err = state.fields?.[name]
  const id = `f-${name}`
  return (
    <div className={className}>
      <label htmlFor={id} className={`mb-1.5 block text-sm font-medium ${dark ? 'text-paper/80' : 'text-ink/80'}`}>
        {label}
      </label>
      <textarea
        id={id}
        name={name}
        rows={4}
        aria-invalid={err ? true : undefined}
        className={`${dark ? 'field-dark' : 'field'} resize-y ${err ? '!border-red-500' : ''}`}
        {...rest}
        defaultValue={state.values?.[name] ?? rest.defaultValue}
      />
      {err && <p className="mt-1.5 text-sm text-red-600">{err}</p>}
    </div>
  )
}

export function Consent({ state, dark = false }: { state: FormState; dark?: boolean }) {
  const err = state.fields?.consent
  return (
    <div>
      <label className={`flex cursor-pointer items-start gap-3 text-sm leading-relaxed ${dark ? 'text-paper/65' : 'text-stone'}`}>
        <input
          type="checkbox"
          name="consent"
          required
          defaultChecked={state.values?.consent === 'on'}
          className="mt-1 h-4 w-4 shrink-0 accent-[#c5a880]"
        />
        <span>
          Souhlasím se zpracováním osobních údajů za účelem vyřízení mé poptávky.{' '}
          <Link href="/ochrana-osobnich-udaju" className="link-u" target="_blank">
            Více o ochraně údajů
          </Link>
          .
        </span>
      </label>
      {err && <p className="mt-1.5 text-sm text-red-600">{err}</p>}
    </div>
  )
}

export function Submit({ children, className = 'btn-gold w-full' }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className={`${className} disabled:cursor-wait disabled:opacity-70`}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
      {pending ? 'Odesílám…' : children}
    </button>
  )
}

export function FormError({ state }: { state: FormState }) {
  if (!state.error) return null
  return (
    <p role="alert" className="border-l-2 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-700">
      {state.error}
    </p>
  )
}

export function Success({ title, children, dark = false }: { title: string; children: React.ReactNode; dark?: boolean }) {
  return (
    <div role="status" className="py-6 text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-gold text-ink">
        <Check className="h-7 w-7" aria-hidden />
      </span>
      <p className={`mt-5 font-serif text-3xl ${dark ? 'text-paper' : 'text-ink'}`}>{title}</p>
      <p className={`mx-auto mt-3 max-w-sm leading-relaxed ${dark ? 'text-paper/65' : 'text-stone'}`}>{children}</p>
    </div>
  )
}
