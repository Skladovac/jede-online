'use client'

import { useActionState } from 'react'
import { login } from '@/app/actions/auth'

const pole = 'mt-1 w-full rounded-panel border border-line bg-card px-3 py-2 text-fg focus:border-line-strong focus:outline-none'

export function LoginForm() {
  const [stav, akce, pending] = useActionState(async (_: { error: string } | null, fd: FormData) => login(fd), null)
  return (
    <form action={akce} className="mt-6 space-y-4">
      <label className="block text-sm">
        E-mail
        <input name="email" type="email" required autoComplete="username" className={pole} />
      </label>
      <label className="block text-sm">
        Heslo
        <input name="password" type="password" required autoComplete="current-password" className={pole} />
      </label>
      {stav?.error && (
        <p role="alert" className="text-sm text-danger">
          {stav.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-panel bg-accent px-5 py-2.5 font-medium text-on-accent hover:bg-accent-hover disabled:opacity-60"
      >
        {pending ? 'Přihlašuji…' : 'Přihlásit se'}
      </button>
    </form>
  )
}
