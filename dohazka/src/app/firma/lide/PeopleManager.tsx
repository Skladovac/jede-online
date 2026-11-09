'use client'

import { useActionState, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addPerson, resendInvitation, setActive, setRole } from '@/app/actions/people'
import { ROLES, ROLE_LABEL, type RoleValue } from '@/lib/role'

const pole = 'mt-1 w-full rounded-panel border border-line bg-card px-3 py-2 text-fg focus:border-line-strong focus:outline-none'

export type Clen = { id: string; name: string; email: string; role: RoleValue; active: boolean; isMe: boolean }

function Radek({ clen }: { clen: Clen }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [chyba, setChyba] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const zmen = (fn: () => Promise<{ ok: true } | { error: string }>) =>
    start(async () => {
      const r = await fn()
      setInfo(null)
      setChyba('error' in r ? r.error : null)
      if ('ok' in r) router.refresh()
    })
  const poslatZnovu = () =>
    start(async () => {
      const r = await resendInvitation(clen.id)
      setChyba('error' in r ? r.error : null)
      setInfo('ok' in r ? (r.emailed ? 'Pozvánka odešla e-mailem.' : 'E-mail se nepodařilo odeslat. Zkus to později.') : null)
    })
  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className={`truncate font-medium ${clen.active ? '' : 'text-muted line-through'}`}>
            {clen.name}
            {clen.isMe && ' (ty)'}
          </p>
          <p className="truncate text-sm text-muted">{clen.email}</p>
        </div>
        <label className="text-sm">
          <span className="sr-only">Role: {clen.name}</span>
          <select
            value={clen.role}
            disabled={pending}
            onChange={(e) => {
              const role = e.target.value
              zmen(() => setRole(clen.id, role))
            }}
            className="min-h-11 rounded-panel border border-line bg-card px-2 py-2"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={pending}
          onClick={() => zmen(() => setActive(clen.id, !clen.active))}
          className="min-h-11 rounded-panel border border-line bg-card px-3 py-2 text-sm font-medium hover:bg-accent-soft disabled:opacity-60"
        >
          {clen.active ? 'Deaktivovat' : 'Znovu aktivovat'}
        </button>
      </div>
      {clen.active && (
        <button type="button" disabled={pending} onClick={poslatZnovu} className="mt-2 min-h-11 text-sm underline disabled:opacity-60">
          Poslat pozvánku znovu
        </button>
      )}
      {info && (
        <p role="status" className="mt-1 text-sm">
          {info}
        </p>
      )}
      {chyba && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {chyba}
        </p>
      )}
    </li>
  )
}

type Stav = Awaited<ReturnType<typeof addPerson>> | null

export function PeopleManager({ lide }: { lide: Clen[] }) {
  const router = useRouter()
  const [stav, akce, pending] = useActionState(async (_: Stav, fd: FormData): Promise<Stav> => {
    const r = await addPerson({
      email: String(fd.get('email') ?? ''),
      name: String(fd.get('name') ?? ''),
      role: String(fd.get('role') ?? '') as RoleValue,
      delivery: fd.get('delivery') === 'password' ? 'password' : 'invite',
    })
    if ('ok' in r) router.refresh()
    return r
  }, null)

  return (
    <>
      <ul className="mt-4 divide-y divide-line rounded-panel border border-line bg-card">
        {lide.map((c) => (
          <Radek key={c.id} clen={c} />
        ))}
      </ul>
      <p className="mt-2 text-sm text-muted">Odcházející lidé se deaktivují, nemažou: jejich zápisy zůstanou ve výkazech.</p>

      <h2 className="mt-8 text-lg font-semibold">Přidat člověka</h2>
      {stav && 'ok' in stav && (
        <section className="mt-3 rounded-panel border border-line bg-card p-4" aria-live="polite">
          {stav.password ? (
            <>
              <p className="text-sm">Heslo nového člověka (zobrazeno jen teď, předej mu ho a nikam ho neukládej):</p>
              <p className="mt-1 select-all break-all font-mono text-lg">{stav.password}</p>
              {stav.invite && (
                <p className="mt-2 text-sm font-semibold">
                  {stav.invite.created ? 'Pozvánku se nepodařilo e-mailem odeslat, proto je tu heslo.' : 'Pozvánku se nepodařilo vytvořit, proto je tu heslo.'}
                </p>
              )}
              <p role="alert" className="mt-2 text-sm font-semibold text-danger">
                Heslo se už znovu nezobrazí.
              </p>
            </>
          ) : stav.invite?.emailed || stav.existing?.emailed ? (
            <p className="text-sm">Člověk dostal e-mail. Pokud šlo o pozvánku, odkaz platí 48 hodin.</p>
          ) : (
            <p className="text-sm">
              E-mail se nepodařilo odeslat. Pokud se člověk nemůže přihlásit, pošli mu v seznamu pozvánku znovu, nebo si může heslo nastavit přes „zapomenuté heslo“.
            </p>
          )}
        </section>
      )}
      <form action={akce} className="mt-3 space-y-4">
        <label className="block text-sm">
          E-mail
          <input name="email" type="email" required maxLength={254} autoComplete="off" className={pole} />
        </label>
        <label className="block text-sm">
          Jméno
          <input name="name" required maxLength={120} autoComplete="off" className={pole} />
        </label>
        <label className="block text-sm">
          Role
          <select name="role" defaultValue="EMPLOYEE" className={pole}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="space-y-2 text-sm">
          <legend>Jak získá přístup</legend>
          <label className="flex items-center gap-2">
            <input type="radio" name="delivery" value="invite" defaultChecked />
            Poslat pozvánku e-mailem
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="delivery" value="password" />
            Vygenerovat heslo (zobrazí se jednou)
          </label>
        </fieldset>
        <p className="text-sm text-muted">Pokud e-mail už v systému je, připojí se existující účet; jeho jméno se nezmění.</p>
        {stav && 'error' in stav && (
          <p role="alert" className="text-sm text-danger">
            {stav.error}
          </p>
        )}
        <button type="submit" disabled={pending} className="rounded-panel bg-accent px-5 py-2.5 font-medium text-on-accent hover:bg-accent-hover disabled:opacity-60">
          {pending ? 'Přidávám…' : 'Přidat'}
        </button>
      </form>
    </>
  )
}
