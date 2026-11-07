'use client'

import { useActionState } from 'react'
import { submitContact, type FormState } from '@/app/actions/leads'
import { BotTrap, Consent, Field, FormError, Submit, Success, TextArea } from '@/components/forms'

export function ContactForm({
  source,
  messageLabel = 'Zpráva',
  placeholder,
  submit = 'Odeslat zprávu',
  agent,
}: {
  source: string
  /** slug makléře — dotaz z jeho osobní stránky */
  agent?: string
  messageLabel?: string
  placeholder?: string
  submit?: string
}) {
  const [state, action] = useActionState<FormState, FormData>(submitContact, {})
  if (state.ok) {
    return <Success title="Děkujeme za zprávu">Ozveme se vám co nejdříve.</Success>
  }
  return (
    <form action={action} className="relative space-y-4" noValidate>
      <input type="hidden" name="source" value={source} />
      {agent && <input type="hidden" name="agent" value={agent} />}
      <BotTrap />
      <Field label="Jméno a příjmení" name="name" state={state} autoComplete="name" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Telefon" name="phone" state={state} type="tel" autoComplete="tel" inputMode="tel" />
        <Field label="E-mail" name="email" state={state} type="email" autoComplete="email" />
      </div>
      <TextArea label={messageLabel} name="message" state={state} rows={5} placeholder={placeholder} />
      <Consent state={state} />
      <FormError state={state} />
      <Submit>{submit}</Submit>
    </form>
  )
}
