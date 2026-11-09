'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { createOrganization } from '@/app/actions/org'

const pole = 'mt-1 w-full rounded-panel border border-line bg-card px-3 py-2 text-fg focus:border-line-strong focus:outline-none'

type Stav = Awaited<ReturnType<typeof createOrganization>> | null

export function NewOrgForm() {
  const [stav, akce, pending] = useActionState(
    async (_: Stav, fd: FormData): Promise<Stav> =>
      createOrganization({
        name: String(fd.get('name') ?? ''),
        reportName: String(fd.get('reportName') ?? ''),
        ownerEmail: String(fd.get('ownerEmail') ?? ''),
        ownerName: String(fd.get('ownerName') ?? ''),
      }),
    null,
  )

  if (stav && 'ok' in stav) {
    return (
      <section className="mt-5 rounded-panel border border-line bg-card p-4">
        <p className="font-semibold">Firma je založená.</p>
        {stav.password ? (
          <>
            <p className="mt-3 text-sm">Heslo nového správce (zobrazeno jen teď, předej ho mu a nikam ho neukládej):</p>
            <p className="mt-1 select-all break-all font-mono text-lg">{stav.password}</p>
          </>
        ) : (
          <p className="mt-3 text-sm text-muted">Správce už účet měl, přihlásí se svým dosavadním heslem.</p>
        )}
        <p className="mt-4 flex gap-4 text-sm">
          <Link href="/admin" className="underline">
            Seznam firem
          </Link>
        </p>
      </section>
    )
  }

  return (
    <form action={akce} className="mt-5 space-y-4">
      <label className="block text-sm">
        Název firmy
        <input name="name" required maxLength={120} className={pole} />
      </label>
      <label className="block text-sm">
        Název ve výkazu
        <input name="reportName" required maxLength={120} className={pole} />
      </label>
      <label className="block text-sm">
        E-mail správce
        <input name="ownerEmail" type="email" required maxLength={254} autoComplete="off" className={pole} />
      </label>
      <label className="block text-sm">
        Jméno správce
        <input name="ownerName" required maxLength={120} autoComplete="off" className={pole} />
      </label>
      <p className="text-sm text-muted">Pokud e-mail už v systému je, připojí se existující účet a jeho heslo se nezmění.</p>
      {stav && 'error' in stav && (
        <p role="alert" className="text-sm text-danger">
          {stav.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-panel bg-accent px-5 py-2.5 font-medium text-on-accent hover:bg-accent-hover disabled:opacity-60"
      >
        {pending ? 'Zakládám…' : 'Založit firmu'}
      </button>
    </form>
  )
}
