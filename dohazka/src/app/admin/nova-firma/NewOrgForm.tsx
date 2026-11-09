'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { createOrganization } from '@/app/actions/org'

const pole = 'mt-1 w-full rounded-panel border border-line bg-card px-3 py-2 text-fg focus:border-line-strong focus:outline-none'

type Stav = Awaited<ReturnType<typeof createOrganization>> | null

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
        } catch {
          setCopied(false) // schránka nemusí být dostupná; heslo jde označit a zkopírovat ručně
        }
      }}
      className="mt-2 min-h-11 rounded-panel border border-line bg-card px-4 py-2 text-sm font-medium hover:bg-accent-soft"
    >
      {copied ? 'Zkopírováno' : 'Zkopírovat heslo'}
    </button>
  )
}

export function NewOrgForm() {
  const [stav, akce, pending] = useActionState(
    async (_: Stav, fd: FormData): Promise<Stav> =>
      createOrganization({
        name: String(fd.get('name') ?? ''),
        reportName: String(fd.get('reportName') ?? ''),
        ownerEmail: String(fd.get('ownerEmail') ?? ''),
        ownerName: String(fd.get('ownerName') ?? ''),
        delivery: fd.get('delivery') === 'invite' ? 'invite' : 'password',
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
            <CopyButton text={stav.password} />
            {stav.invite && (
              <p className="mt-3 text-sm font-semibold">
                {stav.invite.created
                  ? 'Pozvánku se nepodařilo e-mailem odeslat, proto je tu heslo. Předej ho správci.'
                  : 'Pozvánku se nepodařilo vytvořit, proto je tu heslo. Předej ho správci.'}
              </p>
            )}
            <p role="alert" className="mt-3 text-sm font-semibold text-danger">
              Heslo se už znovu nezobrazí. Po obnovení nebo opuštění stránky ho nelze zjistit.
            </p>
          </>
        ) : stav.invite?.emailed ? (
          <p className="mt-3 text-sm">Správce dostal e-mail. Pokud šlo o pozvánku, odkaz platí 48 hodin.</p>
        ) : (
          <p className="mt-3 text-sm font-semibold">E-mail se nepodařilo odeslat. Správce si heslo nastaví na přihlašovací stránce přes „zapomenuté heslo“.</p>
        )}
        <p className="mt-4 flex gap-4 text-sm">
          <Link href="/admin" className="underline">
            Seznam firem
          </Link>
          <a href="/admin/nova-firma" className="underline">
            Založit další firmu
          </a>
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
      <fieldset className="space-y-2 text-sm">
        <legend>Jak správce získá přístup</legend>
        <label className="flex items-center gap-2">
          <input type="radio" name="delivery" value="invite" defaultChecked />
          Poslat pozvánku e-mailem (správce si sám nastaví heslo)
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="delivery" value="password" />
          Vygenerovat heslo (zobrazí se jednou)
        </label>
      </fieldset>
      <p className="text-sm text-muted">Pokud e-mail už v systému je, připojí se existující účet.</p>
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
