'use client'

import { useActionState } from 'react'
import type { FormState } from '@/lib/validation'
import { Alert } from '@/components/ui'

/** Obecný formulář nad server action: zobrazí chybu/úspěch, pole předá jako children. */
export function ActionForm({
  action,
  children,
  className = 'space-y-5',
}: {
  action: (state: FormState, fd: FormData) => Promise<FormState>
  children: React.ReactNode
  className?: string
}) {
  const [state, formAction] = useActionState(action, undefined)
  return (
    <form action={formAction} className={className}>
      <Alert state={state} />
      {children}
    </form>
  )
}
