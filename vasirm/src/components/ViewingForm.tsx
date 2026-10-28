'use client'

import { useActionState } from 'react'
import { submitViewing, type FormState } from '@/app/actions/leads'
import { BotTrap, Consent, Field, FormError, Submit, Success, TextArea } from '@/components/forms'

export function ViewingForm({ listingId, title }: { listingId: string; title: string }) {
  const [state, action] = useActionState<FormState, FormData>(submitViewing, {})
  if (state.ok) {
    return (
      <Success title="Děkujeme, ozveme se">
        Brzy se vám ozveme a domluvíme termín prohlídky, který vám bude vyhovovat.
      </Success>
    )
  }
  return (
    <form action={action} className="relative space-y-4" noValidate>
      <input type="hidden" name="listingId" value={listingId} />
      <BotTrap />
      <Field label="Jméno a příjmení" name="name" state={state} autoComplete="name" required />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <Field label="Telefon" name="phone" state={state} type="tel" autoComplete="tel" inputMode="tel" />
        <Field label="E-mail" name="email" state={state} type="email" autoComplete="email" />
      </div>
      <TextArea
        label="Zpráva (nepovinné)"
        name="message"
        state={state}
        rows={3}
        defaultValue={`Dobrý den, mám zájem o prohlídku nemovitosti ${title}.`}
      />
      <Consent state={state} />
      <FormError state={state} />
      <Submit>Mám zájem o prohlídku</Submit>
    </form>
  )
}
