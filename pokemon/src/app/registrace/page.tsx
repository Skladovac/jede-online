import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { RegisterForm } from './RegisterForm'

export const metadata: Metadata = { title: 'Registrace' }

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect('/ucet')
  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-3xl font-black tracking-tight">Registrace</h1>
      <p className="mb-8 mt-2 text-slate-600 dark:text-slate-300">
        Už máš účet?{' '}
        <Link href="/prihlaseni" className="font-medium underline">
          Přihlas se
        </Link>
      </p>
      <RegisterForm />
    </main>
  )
}
