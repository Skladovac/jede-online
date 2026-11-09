import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { LoginForm } from './LoginForm'

export const metadata: Metadata = { title: 'Přihlášení' }

export default async function PrihlaseniPage({ searchParams }: { searchParams: Promise<{ heslo?: string }> }) {
  const { heslo } = await searchParams
  if (await getCurrentUser()) redirect('/')
  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-semibold">Přihlášení</h1>
      {heslo === 'nastaveno' && (
        <p role="status" className="mt-4 text-sm">
          Heslo je nastavené. Přihlas se.
        </p>
      )}
      <LoginForm />
      <p className="mt-6 text-sm">
        <Link href="/zapomenute-heslo" className="underline">
          Zapomenuté heslo
        </Link>
      </p>
    </main>
  )
}
