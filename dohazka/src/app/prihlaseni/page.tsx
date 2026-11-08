import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { LoginForm } from './LoginForm'

export const metadata: Metadata = { title: 'Přihlášení' }

export default async function PrihlaseniPage() {
  if (await getCurrentUser()) redirect('/')
  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-semibold">Přihlášení</h1>
      <LoginForm />
    </main>
  )
}
