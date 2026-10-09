import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { getCurrentUser, isLimited } from '@/lib/auth'
import { changePassword, deleteAccount, updateProfile } from '@/app/actions/account'
import { logout, resendParent, resendVerify } from '@/app/actions/auth'
import { ActionForm } from '@/components/ActionForm'
import { isAdult } from '@/lib/age'
import { safeNext } from '@/lib/validation'
import { Checkbox, Field, Submit, inputCls } from '@/components/ui'
import { COUNTRY_LABEL, REGIONS } from '@/lib/regions'
import { PasswordInput } from '@/components/PasswordInput'
import { getT } from '@/lib/i18n/server'
import { FollowingList, InviteBox } from '@/components/Social'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t('Můj účet') }
}
export const dynamic = 'force-dynamic'

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ vitej?: string; heslo?: string; next?: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect('/prihlaseni?next=/ucet')
  const oauth = await prisma.oAuthAccount.findMany({ where: { userId: user.id }, select: { provider: true } })
  const { vitej, heslo } = await searchParams
  const next = safeNext((await searchParams).next)
  const limited = isLimited(user)
  const t = await getT()
  const linksPending = user.isMinor && !user.linksApprovedAt && (user.facebookUrl || user.instagramUrl || user.aukroUrl)

  return (
    <main className="mx-auto max-w-2xl space-y-8 px-4 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">{t('Ahoj, {name}!', { name: user.nickname })}</h1>
          {!limited && (
            <Link href={`/@${encodeURIComponent(user.nickname)}`} className="text-sm underline">
              {t('Zobrazit můj veřejný profil')}
            </Link>
          )}
        </div>
        <form action={logout}>
          <button className="text-sm text-slate-500 underline">{t('Odhlásit')}</button>
        </form>
      </div>

      {vitej && (
        <Notice tone="ok">
          {t('Účet je založený. Poslali jsme ti e-mail s odkazem pro potvrzení. Když ho nevidíš, podívej se do složky Spam / Nevyžádaná pošta a označ ho jako „není spam“.')}
          {next && (
            <>
              {' '}
              {t('Po potvrzení tě odkaz vrátí zpátky na stránku, odkud jsi přišel(a).')}{' '}
              <Link href={next} className="font-semibold underline">
                {t('Zpět tam →')}
              </Link>
            </>
          )}
        </Notice>
      )}
      {heslo && <Notice tone="ok">{t('Nové heslo je uložené.')}</Notice>}

      {limited && (
        <Notice tone="warn">
          <p className="font-semibold">{t('Čekáme na souhlas rodiče')}</p>
          <p className="mt-1">
            {t('Poslali jsme e-mail na')} <strong>{user.parentEmail}</strong>.{' '}
            {t('Do schválení si můžeš procházet katalog, ale tvůj profil není vidět a nejde posílat nabídky. E-mail může skončit ve složce Spam / Nevyžádaná pošta.')}
          </p>
          <ActionForm action={resendParent} className="mt-3 space-y-3">
            <Submit variant="ghost">{t('Poslat rodiči e-mail znovu')}</Submit>
          </ActionForm>
        </Notice>
      )}

      {!user.emailVerifiedAt && (
        <Notice tone="warn">
          <p>
            {t('Tvůj e-mail')} <strong>{user.email}</strong>{' '}
            {t('zatím není potvrzený. Odkaz najdeš v e-mailu od Pokémon karty (noreply@jede.online) — podívej se i do složky Spam / Nevyžádaná pošta.')}
          </p>
          <ActionForm action={resendVerify} className="mt-3 space-y-3">
            <Submit variant="ghost">{t('Poslat potvrzovací e-mail znovu')}</Submit>
          </ActionForm>
        </Notice>
      )}

      {!limited && <InviteBox userId={user.id} nickname={user.nickname} />}
      {!limited && <FollowingList userId={user.id} />}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-5 text-lg font-bold">{t('Profil')}</h2>
        <ActionForm action={updateProfile}>
          <Field label={t('Přezdívka')}>
            <input name="nickname" required defaultValue={user.nickname} className={inputCls} />
          </Field>
          <p className="text-sm text-slate-500">{t('Země: {country}', { country: t(COUNTRY_LABEL[user.country]) })}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('Kraj')}>
              <select name="region" defaultValue={user.region ?? ''} className={inputCls}>
                <option value="">–</option>
                {REGIONS[user.country].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </Field>
            <Field label={t('Město')}>
              <input name="city" maxLength={60} defaultValue={user.city ?? ''} className={inputCls} />
            </Field>
          </div>

          <fieldset className="space-y-3">
            <legend className="mb-2 text-sm font-medium">{t('Odkazy (nepovinné)')}</legend>
            {user.isMinor && (
              <p className="text-xs text-slate-500">{t('Odkazy se ostatním zobrazí až po schválení rodičem.')}</p>
            )}
            <input name="facebookUrl" placeholder="facebook.com/…" defaultValue={user.facebookUrl ?? ''} className={inputCls} />
            <input name="instagramUrl" placeholder="instagram.com/…" defaultValue={user.instagramUrl ?? ''} className={inputCls} />
            <input name="aukroUrl" placeholder="aukro.cz/…" defaultValue={user.aukroUrl ?? ''} className={inputCls} />
            {linksPending && <p className="text-xs text-yellow-700 dark:text-yellow-400">{t('Odkazy čekají na schválení rodičem.')}</p>}
          </fieldset>

          {isAdult(user) && (
            <Field
              label={t('Telefon (nepovinné)')}
              hint={t('Uvidí ho jen přihlášení uživatelé s ověřeným e-mailem po kliknutí na „Zobrazit číslo“. Každé zobrazení zaznamenáváme. Smazáním pole číslo z webu zmizí.')}
            >
              <input name="phone" type="tel" inputMode="tel" maxLength={20} placeholder="+420 777 123 456" defaultValue={user.phone ?? ''} className={inputCls} />
            </Field>
          )}

          <Checkbox name="matchEmails" defaultChecked={user.matchEmails}>
            {t('Pošli mi jednou denně e-mail, když někdo nabídne kartu, která mi chybí.')}
          </Checkbox>

          {user.isMinor ? (
            <p className="text-sm text-slate-500">
              {user.indexable ? t('Dohledatelnost přes Google: zapnutá (nastavuje rodič).') : t('Dohledatelnost přes Google: vypnutá (nastavuje rodič).')}
            </p>
          ) : (
            <Checkbox name="indexable" defaultChecked={user.indexable}>
              {t('Chci, aby můj profil šlo najít přes Google.')}
            </Checkbox>
          )}
          <Submit>{t('Uložit')}</Submit>
        </ActionForm>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-1 text-lg font-bold">{t('Přihlášení')}</h2>
        <p className="mb-5 text-sm">
          {t('Přihlašuješ se e-mailem')} <strong className="break-all">{user.email}</strong>
          {user.emailVerifiedAt ? ' ✓' : ` ${t('(zatím nepotvrzený)')}`}
        </p>
        {oauth.length > 0 && (
          <p className="-mt-3 mb-5 text-sm text-slate-600 dark:text-slate-300">
            {t('Propojené přihlášení:')} {oauth.map((o) => (o.provider === 'google' ? 'Google' : 'Facebook')).join(', ')}
          </p>
        )}
        <h3 className="mb-3 font-semibold">{t('Změnit heslo')}</h3>
        <ActionForm action={changePassword} className="space-y-3">
          <Field label={t('Současné heslo')}>
            <PasswordInput name="current" autoComplete="current-password" />
          </Field>
          <Field label={t('Nové heslo')}>
            <PasswordInput name="password" autoComplete="new-password" />
          </Field>
          <Field label={t('Nové heslo znovu')}>
            <PasswordInput name="password2" autoComplete="new-password" />
          </Field>
          <div className="flex flex-wrap items-center gap-4">
            <Submit>{t('Změnit heslo')}</Submit>
            <Link href="/zapomenute-heslo" className="text-sm underline">
              {t('Nepamatuješ si současné heslo?')}
            </Link>
          </div>
        </ActionForm>
      </section>

      <section className="rounded-2xl border border-red-200 p-5 dark:border-red-500/30">
        <h2 className="text-lg font-bold">{t('Smazat účet')}</h2>
        <p className="mb-4 mt-1 text-sm text-slate-500">{t('Smaže profil, sbírku i všechny údaje. Nejde vrátit.')}</p>
        <ActionForm action={deleteAccount} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field
            label={t('Pro potvrzení zadej heslo')}
            hint={oauth.length ? t('Přihlašuješ se přes Google/Facebook a heslo nemáš? Nastav si ho přes „Zapomenuté heslo“ — odkaz přijde na tvůj e-mail.') : undefined}
          >
            <PasswordInput autoComplete="current-password" />
          </Field>
          <Submit variant="danger">{t('Smazat účet')}</Submit>
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
