'use client'

import { useActionState } from 'react'
import { requestPasswordReset } from '@/app/actions/invitation'

const pole = 'mt-1 w-full rounded-panel border border-line bg-card px-3 py-2 text-fg focus:border-line-strong focus:outline-none'

type Stav = Awaited<ReturnType<typeof requestPasswordReset>> | null

export function ResetForm() {
  const [stav, akce, pending] = useActionState(async (_: Stav, fd: FormData) => requestPasswordReset(fd), null)
  if (stav && 'ok' in stav) {
    return (
      <p role="status" className="mt-6 text-sm">
        {stav.message}
      </p>
    )
  }
  return (
    <form action={akce} className="mt-6 space-y-4">
      <label className="block text-sm">
        E-mail
        <input name="email" type="email" required maxLength={254} autoComplete="username" className={pole} />
      </label>
      {stav && 'error' in stav && (
        <p role="alert" className="text-sm text-danger">
          {stav.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-panel bg-accent px-5 py-2.5 font-medium text-on-accent hover:bg-accent-hover disabled:opacity-60"
      >
        {pending ? 'Odesílám…' : 'Poslat odkaz'}
      </button>
    </form>
  )
}
