import type { Metadata } from 'next'
import Link from 'next/link'
import { ResetForm } from './ResetForm'

export const metadata: Metadata = { title: 'Zapomenuté heslo' }

export default function ZapomenuteHesloPage() {
  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-semibold">Zapomenuté heslo</h1>
      <p className="mt-4 text-sm">Zadej e-mail svého účtu. Pošleme ti odkaz pro nastavení nového hesla.</p>
      <ResetForm />
      <p className="mt-6 text-sm">
        <Link href="/prihlaseni" className="underline">
          Zpět na přihlášení
        </Link>
      </p>
    </main>
  )
}
