import type { Metadata } from 'next'
import Link from 'next/link'
import { inspectInvitation } from '@/lib/invitation'
import { PasswordForm } from './PasswordForm'

export const metadata: Metadata = { title: 'Nastavení hesla', robots: { index: false } }

// Veřejná stránka: token v adrese je jediný klíč. Nic se tu nemění, jen se ukáže formulář.
export default async function PozvankaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const inv = await inspectInvitation(token)
  if (!inv) {
    return (
      <main className="mx-auto max-w-sm px-4 py-16">
        <h1 className="text-2xl font-semibold">Odkaz už neplatí</h1>
        <p className="mt-4">Odkaz byl už použitý nebo vypršel. Nové heslo si můžeš vyžádat na přihlašovací stránce.</p>
        <p className="mt-4">
          <Link href="/zapomenute-heslo" className="underline">
            Zapomenuté heslo
          </Link>
        </p>
      </main>
    )
  }
  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-semibold">{inv.kind === 'invite' ? 'Vítej v Docházce' : 'Nové heslo'}</h1>
      <p className="mt-4 text-sm">
        {inv.kind === 'invite' && inv.orgName ? `Firma ${inv.orgName}. ` : ''}
        Účet: {inv.email}
      </p>
      <PasswordForm token={token} />
    </main>
  )
}
