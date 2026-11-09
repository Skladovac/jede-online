import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getOrgContext } from '@/lib/org'
import { logout } from '@/app/actions/auth'

export const metadata: Metadata = { title: 'Bez přístupu' }

// Záměrně nevolá requireOrgContext — ten sem přesměrovává, vznikla by smyčka.
export default async function BezPristupuPage() {
  if (!(await getCurrentUser())) redirect('/prihlaseni')
  if (await getOrgContext()) redirect('/')
  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-semibold">Bez přístupu</h1>
      <p className="mt-4">Tento účet nepatří k žádné firmě. Ozvi se správci své firmy.</p>
      <form action={logout} className="mt-6">
        <button type="submit" className="underline">
          Odhlásit se
        </button>
      </form>
    </main>
  )
}
