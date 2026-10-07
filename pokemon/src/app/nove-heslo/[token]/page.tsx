import type { Metadata } from 'next'
import { resetPassword } from '@/app/actions/auth'
import { ActionForm } from '@/components/ActionForm'
import { Field, Submit, inputCls } from '@/components/ui'
import { PasswordInput } from '@/components/PasswordInput'

export const metadata: Metadata = { title: 'Nové heslo' }

export default async function NewPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="mb-8 text-3xl font-black tracking-tight">Nové heslo</h1>
      <ActionForm action={resetPassword}>
        <input type="hidden" name="token" value={token} />
        <Field label="Nové heslo" hint="Aspoň 8 znaků.">
          <PasswordInput autoComplete="new-password" minLength={8} />
        </Field>
        <Submit>Uložit heslo</Submit>
      </ActionForm>
    </main>
  )
}
