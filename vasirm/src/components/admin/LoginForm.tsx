'use client'

import { startTransition, useActionState } from 'react'
import { Loader2 } from 'lucide-react'
import { login, type AdminState } from '@/app/actions/admin'

export function LoginForm() {
  const [state, action, pending] = useActionState<AdminState, FormData>(login, {})
  return (
    // onSubmit místo action={…}: po špatném heslu zůstane e-mail vyplněný.
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        startTransition(() => action(fd))
      }}
      className="space-y-4"
    >
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-paper/80">
          E-mail
        </label>
        <input id="email" name="email" type="email" autoComplete="username" required className="field-dark" />
      </div>
      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-paper/80">
          Heslo
        </label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="field-dark" />
      </div>
      {state.error && (
        <p role="alert" className="border-l-2 border-red-400 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-gold w-full disabled:opacity-70">
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {pending ? 'Přihlašuji…' : 'Přihlásit se'}
      </button>
    </form>
  )
}
