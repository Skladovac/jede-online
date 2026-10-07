import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser, isLimited } from '@/lib/auth'
import { deleteAccount, updateProfile } from '@/app/actions/account'
import { logout, resendParent, resendVerify } from '@/app/actions/auth'
import { ActionForm } from '@/components/ActionForm'
import { Checkbox, Field, Submit, inputCls } from '@/components/ui'
import { COUNTRY_LABEL, REGIONS } from '@/lib/regions'

export const metadata: Metadata = { title: 'Můj účet' }
export const dynamic = 'force-dynamic'

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ vitej?: string; heslo?: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect('/prihlaseni?next=/ucet')
  const { vitej, heslo } = await searchParams
  const limited = isLimited(user)
  const linksPending = user.isMinor && !user.linksApprovedAt && (user.facebookUrl || user.instagramUrl || user.aukroUrl)

  return (
    <main className="mx-auto max-w-2xl space-y-8 px-4 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Ahoj, {user.nickname}!</h1>
          {!limited && (
            <Link href={`/u/${encodeURIComponent(user.nickname)}`} className="text-sm underline">
              Zobrazit můj veřejný profil
            </Link>
          )}
        </div>
        <form action={logout}>
          <button className="text-sm text-slate-500 underline">Odhlásit</button>
        </form>
      </div>

      {vitej && <Notice tone="ok">Účet je založený. Zkontroluj e-mail a potvrď ho.</Notice>}
      {heslo && <Notice tone="ok">Nové heslo je uložené.</Notice>}

      {limited && (
        <Notice tone="warn">
          <p className="font-semibold">Čekáme na souhlas rodiče</p>
          <p className="mt-1">
            Poslali jsme e-mail na <strong>{user.parentEmail}</strong>. Do schválení si můžeš procházet katalog, ale tvůj
            profil není vidět a nejde posílat nabídky.
          </p>
          <ActionForm action={resendParent} className="mt-3 space-y-3">
            <Submit variant="ghost">Poslat rodiči e-mail znovu</Submit>
          </ActionForm>
        </Notice>
      )}

      {!user.emailVerifiedAt && (
        <Notice tone="warn">
          <p>Tvůj e-mail <strong>{user.email}</strong> zatím není potvrzený.</p>
          <ActionForm action={resendVerify} className="mt-3 space-y-3">
            <Submit variant="ghost">Poslat potvrzovací e-mail znovu</Submit>
          </ActionForm>
        </Notice>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-5 text-lg font-bold">Profil</h2>
        <ActionForm action={updateProfile}>
          <Field label="Přezdívka">
            <input name="nickname" required defaultValue={user.nickname} className={inputCls} />
          </Field>
          <p className="text-sm text-slate-500">Země: {COUNTRY_LABEL[user.country]}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Kraj">
              <select name="region" defaultValue={user.region ?? ''} className={inputCls}>
                <option value="">–</option>
                {REGIONS[user.country].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </Field>
            <Field label="Město">
              <input name="city" maxLength={60} defaultValue={user.city ?? ''} className={inputCls} />
            </Field>
          </div>

          <fieldset className="space-y-3">
            <legend className="mb-2 text-sm font-medium">Odkazy (nepovinné)</legend>
            {user.isMinor && (
              <p className="text-xs text-slate-500">Odkazy se ostatním zobrazí až po schválení rodičem.</p>
            )}
            <input name="facebookUrl" placeholder="facebook.com/…" defaultValue={user.facebookUrl ?? ''} className={inputCls} />
            <input name="instagramUrl" placeholder="instagram.com/…" defaultValue={user.instagramUrl ?? ''} className={inputCls} />
            <input name="aukroUrl" placeholder="aukro.cz/…" defaultValue={user.aukroUrl ?? ''} className={inputCls} />
            {linksPending && <p className="text-xs text-yellow-700 dark:text-yellow-400">Odkazy čekají na schválení rodičem.</p>}
          </fieldset>

          {user.isMinor ? (
            <p className="text-sm text-slate-500">
              Dohledatelnost přes Google: {user.indexable ? 'zapnutá' : 'vypnutá'} (nastavuje rodič).
            </p>
          ) : (
            <Checkbox name="indexable" defaultChecked={user.indexable}>
              Chci, aby můj profil šlo najít přes Google.
            </Checkbox>
          )}
          <Submit>Uložit</Submit>
        </ActionForm>
      </section>

      <section className="rounded-2xl border border-red-200 p-5 dark:border-red-500/30">
        <h2 className="text-lg font-bold">Smazat účet</h2>
        <p className="mb-4 mt-1 text-sm text-slate-500">Smaže profil, sbírku i všechny údaje. Nejde vrátit.</p>
        <ActionForm action={deleteAccount} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label="Pro potvrzení zadej heslo">
            <input name="password" type="password" required autoComplete="current-password" className={inputCls} />
          </Field>
          <Submit variant="danger">Smazat účet</Submit>
        </ActionForm>
      </section>
    </main>
  )
}

function Notice({ tone, children }: { tone: 'ok' | 'warn'; children: React.ReactNode }) {
  const cls =
    tone === 'ok'
      ? 'border-green-200 bg-green-50 text-green-900 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-200'
      : 'border-yellow-300 bg-yellow-50 text-yellow-900 dark:border-yellow-500/30 dark:bg-yellow-400/10 dark:text-yellow-100'
  return <div className={`rounded-2xl border p-4 text-sm ${cls}`}>{children}</div>
}
