import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { login } from '@/app/actions/auth'
import { ActionForm } from '@/components/ActionForm'
import { Field, Submit, inputCls } from '@/components/ui'
import { PasswordInput } from '@/components/PasswordInput'
import { getT } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t('Přihlášení') }
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getCurrentUser()) redirect('/')
  const { next } = await searchParams
  const t = await getT()
  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-3xl font-black tracking-tight">{t('Přihlášení')}</h1>
      <p className="mb-8 mt-2 text-slate-600 dark:text-slate-300">
        {t('Nemáš účet?')}{' '}
        <Link href="/registrace" className="font-medium underline">
          {t('Zaregistruj se')}
        </Link>
      </p>
      <ActionForm action={login}>
        <input type="hidden" name="next" value={next ?? ''} />
        <Field label={t('E-mail')}>
          <input name="email" type="email" required autoComplete="email" className={inputCls} />
        </Field>
        <Field label={t('Heslo')}>
          <PasswordInput autoComplete="current-password" />
        </Field>
        <div className="flex items-center justify-between gap-4">
          <Submit>{t('Přihlásit se')}</Submit>
          <Link href="/zapomenute-heslo" className="text-sm underline">
            {t('Zapomenuté heslo')}
          </Link>
        </div>
      </ActionForm>
    </main>
  )
}
