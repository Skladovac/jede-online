'use client'

import { useFormStatus } from 'react-dom'
import type { FormState } from '@/lib/validation'
import { useT } from '@/lib/i18n/client'

export const inputCls =
  'w-full rounded-xl border border-line-strong bg-card px-3 py-2.5 text-base text-fg outline-none placeholder:text-subtle transition focus:border-accent focus:ring-2 focus:ring-accent-soft'

export function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-subtle">{hint}</span>}
    </label>
  )
}

export function Submit({ children, variant = 'primary' }: { children: React.ReactNode; variant?: 'primary' | 'danger' | 'ghost' }) {
  const { pending } = useFormStatus()
  const t = useT()
  const cls = {
    primary: 'bg-accent-strong text-on-accent hover:bg-accent-hover',
    danger: 'bg-red-600 text-white hover:bg-red-500',
    ghost: 'border border-line-strong hover:border-accent',
  }[variant]
  return (
    <button
      type="submit"
      disabled={pending}
      className={`min-h-11 rounded-xl px-5 py-2.5 font-semibold transition-colors duration-200 disabled:opacity-50 ${cls}`}
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
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent-strong)]" />
      <span>{children}</span>
    </label>
  )
}
