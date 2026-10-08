'use client'

import { useFormStatus } from 'react-dom'
import type { FormState } from '@/lib/validation'
import { useT } from '@/lib/i18n/client'

export const inputCls =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base outline-none transition focus:border-yellow-500 focus:ring-2 focus:ring-yellow-400/40 dark:border-slate-700 dark:bg-slate-900'

export function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-slate-500">{hint}</span>}
    </label>
  )
}

export function Submit({ children, variant = 'primary' }: { children: React.ReactNode; variant?: 'primary' | 'danger' | 'ghost' }) {
  const { pending } = useFormStatus()
  const t = useT()
  const cls = {
    primary: 'bg-slate-900 text-white hover:bg-slate-700 dark:bg-yellow-400 dark:text-slate-900 dark:hover:bg-yellow-300',
    danger: 'bg-red-600 text-white hover:bg-red-500',
    ghost: 'border border-slate-300 hover:border-slate-500 dark:border-slate-700',
  }[variant]
  return (
    <button
      type="submit"
      disabled={pending}
      className={`rounded-xl px-5 py-2.5 font-semibold transition disabled:opacity-50 ${cls}`}
    >
      {pending ? t('Moment…') : children}
    </button>
  )
}

export function Alert({ state }: { state: FormState }) {
  if (!state?.error && !state?.ok) return null
  return (
    <p
      role={state.error ? 'alert' : 'status'}
      className={`rounded-xl px-4 py-3 text-sm ${
        state.error
          ? 'bg-red-50 text-red-800 dark:bg-red-500/10 dark:text-red-300'
          : 'bg-green-50 text-green-800 dark:bg-green-500/10 dark:text-green-300'
      }`}
    >
      {state.error ?? state.ok}
    </p>
  )
}

export function Checkbox({ name, defaultChecked, children }: { name: string; defaultChecked?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex items-start gap-3 text-sm">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 h-5 w-5 shrink-0 accent-yellow-500" />
      <span>{children}</span>
    </label>
  )
}
