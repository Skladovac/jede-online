import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getOrgContext } from '@/lib/org'
import { logout } from '@/app/actions/auth'

export const metadata: Metadata = { title: 'Bez přístupu' }

// Záměrně nevolá requireOrgContext — ten sem přesměrovává, vznikla by smyčka.
export default async function BezPristupuPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/prihlaseni')
  if (await getOrgContext()) redirect('/')
  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-semibold">Bez přístupu</h1>
      {/* Sem chodí i deaktivovaný člen, který k firmě patří — hláška proto mluví o přístupu, ne o členství. */}
      <p className="mt-4">Do žádné firmy teď nemáš přístup. Buď k žádné nepatříš, nebo je tvoje členství neaktivní — ozvi se správci své firmy.</p>
      {user.isSuperAdmin && (
        <p className="mt-4">
          <Link href="/admin" className="underline">
            Správa firem
          </Link>
        </p>
      )}
      <form action={logout} className="mt-6">
        <button type="submit" className="underline">
          Odhlásit se
        </button>
      </form>
    </main>
  )
}
