import type { Metadata } from 'next'
import { requestReset } from '@/app/actions/auth'
import { ActionForm } from '@/components/ActionForm'
import { Field, Submit, inputCls } from '@/components/ui'
import { getT } from '@/lib/i18n/server'
import { AlertTriangle } from 'lucide-react'
import { panel } from '@/components/design'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t('Zapomenuté heslo') }
}

export default async function ForgotPage() {
  const t = await getT()
  return (
    <main className="mx-auto max-w-md px-4 py-10 sm:py-14">
      <div className={`${panel} p-7 sm:p-9`}>
        <h1 className="text-3xl font-extrabold text-fg">{t('Zapomenuté heslo')}</h1>
        <p className="mb-8 mt-2 text-muted">{t('Pošleme ti odkaz pro nastavení nového hesla.')}</p>
        <ActionForm action={requestReset}>
          <Field label={t('E-mail')}>
            <input name="email" type="email" required autoComplete="email" className={inputCls} />
          </Field>
          <div className="flex gap-2.5 rounded-xl border border-line bg-surface p-3.5 text-sm text-fg">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" strokeWidth={1.75} aria-hidden />
            <p>
              {t('E-mail často spadne do složky')} <strong>{t('Spam / Nevyžádaná pošta')}</strong> {t('(hlavně iCloud, Seznam a Gmail).')}{' '}
              {t('Když nepřijde do pár minut, podívej se tam a označ ho jako „není spam“. Odkaz platí 1 hodinu.')}
            </p>
          </div>
          <Submit>{t('Poslat odkaz')}</Submit>
        </ActionForm>
      </div>
    </main>
  )
}
