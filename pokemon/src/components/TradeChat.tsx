'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { sendTradeMessage } from '@/app/actions/chat'
import { useT } from '@/lib/i18n/client'
import type { FormState } from '@/lib/validation'

export type ChatMessage = { id: string; mine: boolean; body: string; at: string }

/** Chat u přijaté výměny: bubliny zpráv, pole na psaní (Enter odešle, Shift+Enter nový řádek), obnova každých 20 s. */
export function TradeChat({ requestId, messages, canWrite, otherName }: { requestId: string; messages: ChatMessage[]; canWrite: boolean; otherName: string }) {
  const t = useT()
  const router = useRouter()
  const [state, action, pending] = useActionState<FormState, FormData>(sendTradeMessage, undefined)
  const form = useRef<HTMLFormElement>(null)
  const list = useRef<HTMLDivElement>(null)

  // Po odeslání vyčistit pole.
  useEffect(() => {
    if (state && 'ok' in state && state.ok !== undefined) form.current?.reset()
  }, [state])
  // Nové zprávy od druhé strany: jednoduchá obnova stránky, dokud je otevřená.
  useEffect(() => {
    if (!canWrite) return
    const id = setInterval(() => router.refresh(), 20_000)
    return () => clearInterval(id)
  }, [canWrite, router])
  // Seznam vždy odscrollovat na poslední zprávu.
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight })
  }, [messages.length])

  return (
    <section id="chat" className="scroll-mt-24 rounded-panel border border-line bg-card p-5 shadow-soft">
      <h2 className="font-bold text-fg">💬 {t('Zprávy s {name}', { name: otherName })}</h2>
      <div ref={list} className="mt-4 max-h-[420px] space-y-2 overflow-y-auto pr-1" aria-live="polite">
        {messages.length === 0 && <p className="text-sm text-muted">{t('Zatím žádné zprávy. Domluvte se tu na předání nebo zaslání.')}</p>}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm ${
                m.mine ? 'rounded-br-md bg-brand-yellow text-brand-blue-deep' : 'rounded-bl-md bg-surface text-fg'
              }`}
            >
              {m.body}
              <span className={`mt-0.5 block text-right text-[10px] ${m.mine ? 'text-brand-blue-deep/70' : 'text-subtle'}`}>{m.at}</span>
            </div>
          </div>
        ))}
      </div>
      {canWrite ? (
        <form ref={form} action={action} className="mt-4 flex items-end gap-2">
          <input type="hidden" name="requestId" value={requestId} />
          <label htmlFor="chat-body" className="sr-only">
            {t('Zpráva')}
          </label>
          <textarea
            id="chat-body"
            name="body"
            rows={2}
            maxLength={1000}
            required
            placeholder={t('Napiš zprávu…')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                e.currentTarget.form?.requestSubmit()
              }
            }}
            className="min-h-11 flex-1 resize-y rounded-panel border border-line-strong bg-surface px-3 py-2.5 text-base text-fg outline-none placeholder:text-subtle focus:border-accent focus:ring-2 focus:ring-accent-soft"
          />
          <button
            disabled={pending}
            className="h-11 shrink-0 rounded-[11px] bg-accent-strong px-5 font-bold text-on-accent transition-colors duration-200 hover:bg-accent-hover disabled:opacity-50"
          >
            {pending ? '…' : t('Odeslat')}
          </button>
        </form>
      ) : (
        <p className="mt-4 text-xs text-muted">{t('Výměna je uzavřená — zprávy jsou jen pro čtení.')}</p>
      )}
      {state?.error && <p className="mt-2 text-sm text-danger">{state.error}</p>}
      <p className="mt-3 text-xs text-subtle">
        {t('Neposílej sem hesla ani čísla platebních karet. Web neřeší platby. U dětí nechte domluvu na rodičích.')}
      </p>
    </section>
  )
}
