'use client'

import Link from 'next/link'
import { startTransition, useActionState, useState } from 'react'
import { register } from '@/app/actions/auth'
import { Alert, Checkbox, Field, inputCls } from '@/components/ui'
import { needsParentConsent, CONSENT_AGE, type CountryCode } from '@/lib/age'
import { REGIONS } from '@/lib/regions'
import { PasswordInput } from '@/components/PasswordInput'

const MONTHS = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec']

export function RegisterForm() {
  const [state, action, pending] = useActionState(register, undefined)
  const f = state?.fields ?? {}
  const [country, setCountry] = useState<CountryCode>((f.country as CountryCode) || 'CZ')
  const [year, setYear] = useState(f.birthYear ?? '')
  const [month, setMonth] = useState(f.birthMonth ?? '')
  const thisYear = new Date().getFullYear()
  // Pole pro rodiče se ukáže hned, jak je jasné, že je potřeba (stejná logika jako na serveru).
  const minor = year && month ? needsParentConsent(Number(year), Number(month), country) : false

  return (
    <form
      action={action}
      // Bez automatického resetu formuláře po chybě (React 19 by vymazal i vybraný rok narození).
      onSubmit={(e) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        startTransition(() => action(fd))
      }}
      className="space-y-5"
    >
      <Alert state={state} />
      <Field label="E-mail">
        <input name="email" type="email" required autoComplete="email" defaultValue={f.email} className={inputCls} />
      </Field>
      <Field label="Heslo" hint="Aspoň 8 znaků.">
        <PasswordInput autoComplete="new-password" minLength={8} />
      </Field>
      <Field label="Přezdívka" hint="Uvidí ji ostatní. Nepiš skutečné jméno a příjmení.">
        <input name="nickname" required minLength={3} maxLength={20} defaultValue={f.nickname} className={inputCls} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Rok narození">
          <select name="birthYear" required value={year} onChange={(e) => setYear(e.target.value)} className={inputCls}>
            <option value="">–</option>
            {Array.from({ length: 90 }, (_, i) => thisYear - 4 - i).map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </Field>
        <Field label="Měsíc narození">
          <select name="birthMonth" required value={month} onChange={(e) => setMonth(e.target.value)} className={inputCls}>
            <option value="">–</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Země">
        <select
          name="country"
          value={country}
          onChange={(e) => setCountry(e.target.value as CountryCode)}
          className={inputCls}
        >
          <option value="CZ">Česko</option>
          <option value="SK">Slovensko</option>
        </select>
      </Field>

      {minor && (
        <div className="space-y-3 rounded-2xl border border-yellow-300 bg-yellow-50 p-4 dark:border-yellow-500/30 dark:bg-yellow-400/5">
          <p className="text-sm">
            Je ti méně než {CONSENT_AGE[country]} let, takže účet musí schválit rodič. Pošleme mu e-mail s odkazem. Do té
            doby si můžeš prohlížet katalog a vést sbírku, ale profil nebude vidět a nepůjde posílat nabídky.
          </p>
          <Field label="E-mail rodiče" hint="E-mail od noreply@jede.online může skončit ve složce Spam / Nevyžádaná pošta.">
            <input name="parentEmail" type="email" required defaultValue={f.parentEmail} className={inputCls} />
          </Field>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Kraj" hint="Nepovinné. Pomůže najít sběratele poblíž.">
          <select name="region" defaultValue={f.region ?? ''} key={country} className={inputCls}>
            <option value="">–</option>
            {REGIONS[country].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </Field>
        <Field label="Město" hint="Nepovinné. Stačí větší město, ne přesná adresa.">
          <input name="city" maxLength={60} defaultValue={f.city} className={inputCls} />
        </Field>
      </div>

      <div className="space-y-3">
        {!minor && (
          <Checkbox name="indexable">Chci, aby můj profil šlo najít přes Google.</Checkbox>
        )}
        <Checkbox name="terms">
          Souhlasím s{' '}
          <Link href="/soukromi" target="_blank" className="underline">
            pravidly a zásadami ochrany osobních údajů
          </Link>
          .
        </Checkbox>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-slate-900 px-5 py-2.5 font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50 dark:bg-yellow-400 dark:text-slate-900 dark:hover:bg-yellow-300"
      >
        {pending ? 'Moment…' : 'Zaregistrovat se'}
      </button>
    </form>
  )
}
