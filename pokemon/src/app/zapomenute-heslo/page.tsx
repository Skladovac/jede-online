import type { Metadata } from 'next'
import { requestReset } from '@/app/actions/auth'
import { ActionForm } from '@/components/ActionForm'
import { Field, Submit, inputCls } from '@/components/ui'

export const metadata: Metadata = { title: 'Zapomenuté heslo' }

export default function ForgotPage() {
  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-3xl font-black tracking-tight">Zapomenuté heslo</h1>
      <p className="mb-8 mt-2 text-slate-600 dark:text-slate-300">Pošleme ti odkaz pro nastavení nového hesla.</p>
      <ActionForm action={requestReset}>
        <Field label="E-mail">
          <input name="email" type="email" required autoComplete="email" className={inputCls} />
        </Field>
        <Submit>Poslat odkaz</Submit>
      </ActionForm>
    </main>
  )
}
