import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { RegisterForm } from './RegisterForm'
import { safeNext } from '@/lib/validation'
import { getT } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t('Registrace') }
}

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next)
  if (await getCurrentUser()) redirect(next ?? '/')
  const t = await getT()
  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-3xl font-black tracking-tight">{t('Registrace')}</h1>
      <p className="mb-8 mt-2 text-slate-600 dark:text-slate-300">
        {t('Už máš účet?')}{' '}
        <Link href={next ? `/prihlaseni?next=${encodeURIComponent(next)}` : '/prihlaseni'} className="font-medium underline">
          {t('Přihlas se')}
        </Link>
      </p>
      <RegisterForm next={next} />
    </main>
  )
}
