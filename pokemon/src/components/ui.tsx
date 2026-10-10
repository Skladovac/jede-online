'use client'

import { useFormStatus } from 'react-dom'
import type { FormState } from '@/lib/validation'
import { useT } from '@/lib/i18n/client'
import { btnPrimary, btnSecondary } from '@/components/design'

export const inputCls =
  'w-full min-h-[46px] rounded-xl border border-line-strong bg-card px-3.5 py-2.5 text-base text-fg outline-none placeholder:text-subtle transition focus:border-brand-blue focus:ring-4 focus:ring-[rgba(42,117,187,0.15)] dark:focus:ring-[rgba(42,117,187,0.3)]'

export function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[13.5px] font-semibold text-fg">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </label>
  )
}

export function Submit({ children, variant = 'primary' }: { children: React.ReactNode; variant?: 'primary' | 'danger' | 'ghost' }) {
  const { pending } = useFormStatus()
  const t = useT()
  const cls = {
    primary: btnPrimary,
    danger:
      'inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-danger px-5 py-2.5 font-bold text-white transition duration-200 hover:opacity-90 active:translate-y-px',
    ghost: btnSecondary,
  }[variant]
  return (
    <button type="submit" disabled={pending} className={`${cls} disabled:opacity-50`}>
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
          ? 'bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] text-danger'
          : 'bg-[color-mix(in_srgb,var(--positive)_10%,transparent)] text-positive'
      }`}
    >
      {state.error ?? state.ok}
    </p>
  )
}

export function Checkbox({ name, defaultChecked, children }: { name: string; defaultChecked?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex items-start gap-3 text-sm text-fg">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--pokemon-blue)]" />
      <span>{children}</span>
    </label>
  )
}
