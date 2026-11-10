'use client'

import { useActionState } from 'react'
import { setPassword } from '@/app/actions/invitation'

const pole = 'mt-1 w-full rounded-panel border border-line bg-card px-3 py-2 text-fg focus:border-line-strong focus:outline-none'

export function PasswordForm({ token }: { token: string }) {
  const [stav, akce, pending] = useActionState(async (_: { error: string } | null, fd: FormData) => setPassword(token, fd), null)
  return (
    <form action={akce} className="mt-6 space-y-4">
      <label className="block text-sm">
        Nové heslo (aspoň 10 znaků)
        <input name="password" type="password" required minLength={10} maxLength={200} autoComplete="new-password" className={pole} />
      </label>
      <label className="block text-sm">
        Nové heslo znovu
        <input name="password2" type="password" required minLength={10} maxLength={200} autoComplete="new-password" className={pole} />
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
        {pending ? 'Ukládám…' : 'Nastavit heslo'}
      </button>
    </form>
  )
}
