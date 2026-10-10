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
import { linkAccent, panel } from '@/components/design'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t('Přihlášení') }
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; chyba?: string }> }) {
  if (await getCurrentUser()) redirect('/')
  const { next, chyba } = await searchParams
  const t = await getT()
  return (
    <main className="mx-auto max-w-md px-4 py-10 sm:py-14">
      <div className={`${panel} p-7 sm:p-9`}>
        <h1 className="text-3xl font-extrabold text-fg">{t('Přihlášení')}</h1>
        <p className="mb-8 mt-2 text-muted">
          {t('Nemáš účet?')}{' '}
          <Link href="/registrace" className={linkAccent}>
            {t('Zaregistruj se')}
          </Link>
        </p>
        {chyba && (
          <p role="alert" className="mb-6 rounded-xl bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] px-4 py-3 text-sm text-danger">
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
            <Link href="/zapomenute-heslo" className={`text-sm ${linkAccent}`}>
              {t('Zapomenuté heslo')}
            </Link>
          </div>
        </ActionForm>
      </div>
    </main>
  )
}
