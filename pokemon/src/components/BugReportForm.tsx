'use client'

import { useActionState, useEffect, useState } from 'react'
import { reportBug } from '@/app/actions/bugs'
import { Alert, inputCls } from '@/components/ui'
import { useT } from '@/lib/i18n/client'
import { btnPrimary, panel } from '@/components/design'

/** "Nahlásit chybu" v patičce — rozbalí se malý formulář. */
export function BugReportForm({ loggedIn }: { loggedIn: boolean }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [state, action, pending] = useActionState(reportBug, undefined)
  useEffect(() => setUrl(window.location.href), [open])

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="underline">
        {t('Nahlásit chybu')}
      </button>
    )

  return (
    <form action={action} className={`mt-3 max-w-lg space-y-3 ${panel} p-4`}>
      <p className="font-semibold text-fg">{t('Nahlásit chybu')}</p>
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
            placeholder={t('Co nefunguje? Co jsi dělal(a) a co se stalo?')}
            className={inputCls}
          />
          {!loggedIn && (
            <input name="contact" type="email" placeholder={t('Tvůj e-mail (nepovinné, kdybychom se potřebovali doptat)')} className={inputCls} />
          )}
          <div className="flex gap-3">
            <button disabled={pending} className={`${btnPrimary} text-sm disabled:opacity-50`}>
              {pending ? t('Odesílám…') : t('Odeslat')}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="min-h-11 text-sm text-muted underline underline-offset-4 hover:text-fg">
              {t('Zavřít')}
            </button>
          </div>
        </>
      )}
    </form>
  )
}
