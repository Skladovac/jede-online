import type { Metadata } from 'next'
import { resetPassword } from '@/app/actions/auth'
import { ActionForm } from '@/components/ActionForm'
import { Field, Submit, inputCls } from '@/components/ui'
import { PasswordInput } from '@/components/PasswordInput'
import { getT } from '@/lib/i18n/server'
import { panel } from '@/components/design'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t('Nové heslo') }
}

export default async function NewPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const t = await getT()
  return (
    <main className="mx-auto max-w-md px-4 py-10 sm:py-14">
      <div className={`${panel} p-7 sm:p-9`}>
        <h1 className="mb-8 text-3xl font-extrabold text-fg">{t('Nové heslo')}</h1>
        <ActionForm action={resetPassword}>
          <input type="hidden" name="token" value={token} />
          <Field label={t('Nové heslo')} hint={t('Aspoň 8 znaků.')}>
            <PasswordInput autoComplete="new-password" minLength={8} />
          </Field>
          <Submit>{t('Uložit heslo')}</Submit>
        </ActionForm>
      </div>
    </main>
  )
}
