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
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-3xl font-black tracking-tight">{t('Registrace')}</h1>
      <p className="mb-8 mt-2 text-muted">
        {t('Už máš účet?')}{' '}
        <Link href={next ? `/prihlaseni?next=${encodeURIComponent(next)}` : '/prihlaseni'} className="font-medium underline">
          {t('Přihlas se')}
        </Link>
      </p>
      {inviter && (
        <p className="mb-6 rounded-panel border-2 border-line-strong bg-accent-soft p-4 text-sm">
          🎁 {t('Pozval(a) tě {name}. Po registraci se budete navzájem sledovat a uvidíš, co nabízí.', { name: inviter })}
        </p>
      )}
      <SocialButtons next={next} />
      <RegisterForm next={next} />
    </main>
  )
}
