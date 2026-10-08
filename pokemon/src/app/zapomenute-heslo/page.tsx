import type { Metadata } from 'next'
import { requestReset } from '@/app/actions/auth'
import { ActionForm } from '@/components/ActionForm'
import { Field, Submit, inputCls } from '@/components/ui'
import { getT } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t('Zapomenuté heslo') }
}

export default async function ForgotPage() {
  const t = await getT()
  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-3xl font-black tracking-tight">{t('Zapomenuté heslo')}</h1>
      <p className="mb-8 mt-2 text-slate-600 dark:text-slate-300">{t('Pošleme ti odkaz pro nastavení nového hesla.')}</p>
      <ActionForm action={requestReset}>
        <Field label={t('E-mail')}>
          <input name="email" type="email" required autoComplete="email" className={inputCls} />
        </Field>
        <div className="rounded-xl border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900 dark:border-yellow-500/30 dark:bg-yellow-400/10 dark:text-yellow-100">
          ⚠️ {t('E-mail často spadne do složky')} <strong>{t('Spam / Nevyžádaná pošta')}</strong> {t('(hlavně iCloud, Seznam a Gmail).')}{' '}
          {t('Když nepřijde do pár minut, podívej se tam a označ ho jako „není spam“. Odkaz platí 1 hodinu.')}
        </div>
        <Submit>{t('Poslat odkaz')}</Submit>
      </ActionForm>
    </main>
  )
}
