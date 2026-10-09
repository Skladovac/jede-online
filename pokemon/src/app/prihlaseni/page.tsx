import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { login } from '@/app/actions/auth'
import { ActionForm } from '@/components/ActionForm'
import { Field, Submit, inputCls } from '@/components/ui'
import { PasswordInput } from '@/components/PasswordInput'
import { getT } from '@/lib/i18n/server'
import { SocialButtons } from '@/components/SocialButtons'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t('Přihlášení') }
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; chyba?: string }> }) {
  if (await getCurrentUser()) redirect('/')
  const { next, chyba } = await searchParams
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
      {chyba && (
        <p className="mb-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-500/10 dark:text-red-200">
          {chyba === 'blokovan' ? t('Tento účet je zablokovaný.') : t('Přihlášení přes Google nebo Facebook se nepovedlo. Zkus to prosím znovu.')}
        </p>
      )}
      <SocialButtons next={next} />
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
