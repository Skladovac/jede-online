import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { OAUTH_PENDING_COOKIE, verify, type OAuthProfile } from '@/lib/oauth'
import { RegisterForm } from '../RegisterForm'
import { getT } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t('Dokončení registrace'), robots: { index: false, follow: false } }
}

/** Po přihlášení přes Google/Facebook: nový uživatel doplní přezdívku, věk a kraj (u dětí e-mail rodiče). */
export default async function CompleteSignupPage() {
  if (await getCurrentUser()) redirect('/')
  const pending = verify<OAuthProfile & { next: string }>((await cookies()).get(OAUTH_PENDING_COOKIE)?.value)
  if (!pending) redirect('/registrace')
  const t = await getT()
  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-3xl font-black tracking-tight">{t('Ještě pár údajů')}</h1>
      <p className="mb-8 mt-2 text-slate-600 dark:text-slate-300">
        {pending.name ? t('Ahoj {name}! ', { name: pending.name.split(' ')[0] }) : ''}
        {t('Vyber si přezdívku a doplň datum narození — podle něj poznáme, jestli je potřeba souhlas rodiče. Heslo nepotřebuješ.')}
      </p>
      <RegisterForm social={{ email: pending.email, provider: pending.provider }} />
    </main>
  )
}
