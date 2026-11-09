import type { Metadata } from 'next'
import Link from 'next/link'
import { requireOrgContext } from '@/lib/org'
import { can } from '@/lib/role'
import { pushPublicKey } from '@/lib/push'
import { logout } from '@/app/actions/auth'
import { PushSettings } from '@/components/Push'

export const metadata: Metadata = { title: 'Nastavení' }

export default async function NastaveniPage() {
  const ctx = await requireOrgContext()
  const publicKey = pushPublicKey()

  return (
    <main className="mx-auto w-full max-w-md px-4 py-6">
      <Link href="/" className="text-sm text-muted hover:text-fg">
        ← Zpět
      </Link>
      <h1 className="mt-3 text-xl font-semibold">Nastavení</h1>

      <section className="mt-5 rounded-panel border border-line bg-card p-4">
        <h2 className="mb-3 font-semibold">Večerní připomínka</h2>
        {publicKey ? (
          <PushSettings publicKey={publicKey} remindHour={ctx.org.remindHour} orgName={ctx.org.name} remindEnabled={ctx.user.remindEnabled} />
        ) : (
          <p className="text-sm text-muted">Notifikace nejsou na tomto serveru nastavené.</p>
        )}
      </section>

      {can(ctx.role, 'managePeople', ctx.isSuperAdmin) && (
        <Link href="/firma/lide" className="mt-5 flex min-h-11 items-center rounded-panel border border-line bg-card px-4 font-medium hover:bg-accent-soft">
          Lidé ve firmě
        </Link>
      )}

      <form action={logout} className="mt-6">
        <button type="submit" className="min-h-11 rounded-panel border border-line bg-card px-4 py-2 font-medium hover:bg-accent-soft">
          Odhlásit se
        </button>
      </form>
    </main>
  )
}
