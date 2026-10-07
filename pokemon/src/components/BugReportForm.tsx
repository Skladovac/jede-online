'use client'

import { useActionState, useEffect, useState } from 'react'
import { reportBug } from '@/app/actions/bugs'
import { Alert, inputCls } from '@/components/ui'

/** "Nahlásit chybu" v patičce — rozbalí se malý formulář. */
export function BugReportForm({ loggedIn }: { loggedIn: boolean }) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [state, action, pending] = useActionState(reportBug, undefined)
  useEffect(() => setUrl(window.location.href), [open])

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="underline">
        Nahlásit chybu
      </button>
    )

  return (
    <form action={action} className="mt-3 max-w-lg space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="font-semibold text-slate-700 dark:text-slate-200">Nahlásit chybu</p>
      {state?.ok ? (
        <Alert state={state} />
      ) : (
        <>
          <Alert state={state} />
          <input type="hidden" name="pageUrl" value={url} />
          {/* past na roboty — člověk pole nevidí */}
          <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
          <textarea
            name="message"
            required
            minLength={10}
            maxLength={2000}
            rows={4}
            placeholder="Co nefunguje? Co jsi dělal(a) a co se stalo?"
            className={inputCls}
          />
          {!loggedIn && (
            <input name="contact" type="email" placeholder="Tvůj e-mail (nepovinné, kdybychom se potřebovali doptat)" className={inputCls} />
          )}
          <div className="flex gap-3">
            <button
              disabled={pending}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-yellow-400 dark:text-slate-900"
            >
              {pending ? 'Odesílám…' : 'Odeslat'}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="text-sm underline">
              Zavřít
            </button>
          </div>
        </>
      )}
    </form>
  )
}
