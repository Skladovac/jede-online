import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { RegisterForm } from './RegisterForm'
import { safeNext } from '@/lib/validation'
import { getT } from '@/lib/i18n/server'
import { SocialButtons } from '@/components/SocialButtons'
import { cookies } from 'next/headers'
import { INVITE_COOKIE } from '@/lib/social'
import { Gift } from 'lucide-react'
import { linkAccent, panel } from '@/components/design'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t('Registrace') }
}

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string; pozval?: string }> }) {
  const next = safeNext((await searchParams).next)
  const inviter = (await cookies()).get(INVITE_COOKIE)?.value ?? null
  if (await getCurrentUser()) redirect(next ?? '/')
  const t = await getT()
  return (
    <main className="mx-auto max-w-md px-4 py-10 sm:py-14">
      <div className={`${panel} p-7 sm:p-9`}>
        <h1 className="text-3xl font-extrabold text-fg">{t('Registrace')}</h1>
        <p className="mb-8 mt-2 text-muted">
          {t('Už máš účet?')}{' '}
          <Link href={next ? `/prihlaseni?next=${encodeURIComponent(next)}` : '/prihlaseni'} className={linkAccent}>
            {t('Přihlas se')}
          </Link>
        </p>
        {inviter && (
          <p className="mb-6 flex gap-2.5 rounded-xl bg-accent-soft p-4 text-sm text-fg">
            <Gift className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={1.75} aria-hidden />
            <span>{t('Pozval(a) tě {name}. Po registraci se budete navzájem sledovat a uvidíš, co nabízí.', { name: inviter })}</span>
          </p>
        )}
        <SocialButtons next={next} />
        <RegisterForm next={next} />
      </div>
    </main>
  )
}
