'use client'

import { useState } from 'react'
import { inputCls } from '@/components/ui'

/** Pole pro heslo s tlačítkem „zobrazit“ (hlavně kvůli dětem a mobilům, kde se snadno překlepne). */
export function PasswordInput({
  name = 'password',
  autoComplete,
  minLength,
}: {
  name?: string
  autoComplete: 'new-password' | 'current-password'
  minLength?: number
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        name={name}
        type={show ? 'text' : 'password'}
        required
        minLength={minLength}
        autoComplete={autoComplete}
        className={inputCls + ' pr-24'}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Skrýt heslo' : 'Zobrazit heslo'}
        aria-pressed={show}
        className="absolute inset-y-0 right-0 px-3 text-sm font-medium text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
      >
        {show ? 'Skrýt' : 'Zobrazit'}
      </button>
    </div>
  )
}
