import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { giveConsent, parentDeleteAccount, revokeConsent, updateParentSettings } from '@/app/actions/parent'
import { ActionForm } from '@/components/ActionForm'
import { Checkbox, Field, Submit, inputCls } from '@/components/ui'
import { COUNTRY_LABEL } from '@/lib/regions'

export const metadata: Metadata = { title: 'Správa účtu dítěte', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function ParentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const child = await prisma.user.findUnique({ where: { parentToken: token } })
  if (!child) notFound()

  const links = [
    ['Facebook', child.facebookUrl],
    ['Instagram', child.instagramUrl],
    ['Aukro', child.aukroUrl],
  ].filter(([, v]) => v) as [string, string][]

  return (
    <main className="mx-auto max-w-2xl space-y-8 px-4 py-10">
      <div>
        <p className="text-sm text-slate-500">Správa účtu pro rodiče</p>
        <h1 className="text-3xl font-black tracking-tight">Účet „{child.nickname}“</h1>
        <p className="mt-2 text-sm">
          Stav:{' '}
          {child.parentConsentAt ? (
            <strong className="text-green-700 dark:text-green-400">
              souhlas udělen {child.parentConsentAt.toLocaleDateString('cs-CZ')} ({child.parentConsentName})
            </strong>
          ) : (
            <strong className="text-yellow-700 dark:text-yellow-400">čeká na váš souhlas</strong>
          )}
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-4 text-lg font-bold">Co dítě zadalo</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-slate-500">Přezdívka (veřejná)</dt>
          <dd>{child.nickname}</dd>
          <dt className="text-slate-500">E-mail dítěte (neveřejný)</dt>
          <dd>{child.email}</dd>
          <dt className="text-slate-500">Narození (neveřejné)</dt>
          <dd>
            {child.birthMonth}/{child.birthYear}
          </dd>
          <dt className="text-slate-500">Země, kraj, město (veřejné)</dt>
          <dd>{[COUNTRY_LABEL[child.country], child.region, child.city].filter(Boolean).join(', ')}</dd>
          <dt className="text-slate-500">Odkazy</dt>
          <dd className="space-y-1">
            {links.length
              ? links.map(([k, v]) => (
                  <a key={k} href={v} target="_blank" rel="noopener noreferrer nofollow" className="block break-all underline">
                    {k}: {v}
                  </a>
                ))
              : 'žádné'}
          </dd>
        </dl>
        <div className="mt-5 space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <p>
            <strong>Jak web funguje:</strong> dítě si eviduje sbírku karet a může nabídnout karty k výměně, prodeji nebo darování.
            Na webu není chat. Když se dva uživatelé shodnou na výměně, zpřístupní se jim navzájem e-mail a domluví se
            sami. Web neřeší peníze ani doručení.
          </p>
          <p>O každé nabídce, kterou dítě dostane nebo pošle, vám přijde kopie e-mailu.</p>
        </div>
      </section>

      {!child.parentConsentAt ? (
        <section className="rounded-2xl border border-yellow-300 bg-yellow-50 p-5 dark:border-yellow-500/30 dark:bg-yellow-400/5">
          <h2 className="mb-4 text-lg font-bold">Souhlas zákonného zástupce</h2>
          <ActionForm action={giveConsent}>
            <input type="hidden" name="token" value={token} />
            <Field label="Vaše jméno a příjmení">
              <input name="parentName" required minLength={3} maxLength={80} className={inputCls} />
            </Field>
            <Checkbox name="indexable">Profil dítěte smí být k nalezení přes Google (doporučujeme nechat vypnuté).</Checkbox>
            <Checkbox name="confirm">
              Jsem zákonný zástupce dítěte a souhlasím se zpracováním jeho osobních údajů podle{' '}
              <a href="/soukromi" target="_blank" className="underline">
                zásad ochrany osobních údajů
              </a>
              .
            </Checkbox>
            <Submit>Udělit souhlas</Submit>
          </ActionForm>
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 text-lg font-bold">Nastavení</h2>
          <ActionForm action={updateParentSettings}>
            <input type="hidden" name="token" value={token} />
            <Checkbox name="indexable" defaultChecked={child.indexable}>
              Profil smí být k nalezení přes Google
            </Checkbox>
            {links.length > 0 && (
              <>
                <Checkbox name="approveLinks" defaultChecked={!!child.linksApprovedAt}>
                  Schvaluji zobrazení odkazů výše na profilu
                </Checkbox>
                <Checkbox name="clearLinks">Odkazy smazat</Checkbox>
              </>
            )}
            {child.city && <Checkbox name="clearCity">Smazat město z profilu (kraj zůstane)</Checkbox>}
            <Submit>Uložit nastavení</Submit>
          </ActionForm>
          <div className="mt-6 border-t border-slate-200 pt-5 dark:border-slate-800">
            <ActionForm action={revokeConsent}>
              <input type="hidden" name="token" value={token} />
              <p className="text-sm text-slate-500">
                Odvoláním souhlasu se účet znovu omezí (profil skrytý, žádné nabídky) a dítě se odhlásí.
              </p>
              <Submit variant="ghost">Odvolat souhlas</Submit>
            </ActionForm>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-red-200 p-5 dark:border-red-500/30">
        <h2 className="text-lg font-bold">Smazat účet dítěte</h2>
        <p className="mb-4 mt-1 text-sm text-slate-500">Smaže profil, sbírku i všechny údaje. Nejde vrátit.</p>
        <ActionForm action={parentDeleteAccount}>
          <input type="hidden" name="token" value={token} />
          <Field label={`Pro potvrzení opište přezdívku: ${child.nickname}`}>
            <input name="confirmNick" required className={inputCls} />
          </Field>
          <Submit variant="danger">Smazat účet</Submit>
        </ActionForm>
      </section>

      <p className="text-xs text-slate-500">
        Tento odkaz si uschovejte, slouží ke správě účtu. Nikomu ho neposílejte. Dotazy: info@jede.online
      </p>
    </main>
  )
}
