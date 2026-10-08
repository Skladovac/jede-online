import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { sha256 } from '@/lib/auth'
import { giveConsent, parentDeleteAccount, revokeConsent, updateParentSettings } from '@/app/actions/parent'
import { ActionForm } from '@/components/ActionForm'
import { Checkbox, Field, Submit, inputCls } from '@/components/ui'
import { COUNTRY_LABEL } from '@/lib/regions'
import { getLocale, getT } from '@/lib/i18n/server'
import { LOCALE_INFO } from '@/lib/i18n/config'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t('Správa účtu dítěte'), robots: { index: false, follow: false } }
}
export const dynamic = 'force-dynamic'

export default async function ParentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  // V DB je jen otisk odkazu (sha256), proto se příchozí token před hledáním zahashuje.
  const child = await prisma.user.findUnique({ where: { parentToken: sha256(token) } })
  if (!child) notFound()
  const t = await getT()
  const locale = await getLocale()

  const links = [
    ['Facebook', child.facebookUrl],
    ['Instagram', child.instagramUrl],
    ['Aukro', child.aukroUrl],
  ].filter(([, v]) => v) as [string, string][]

  return (
    <main className="mx-auto max-w-2xl space-y-8 px-4 py-10">
      <div>
        <p className="text-sm text-slate-500">{t('Správa účtu pro rodiče')}</p>
        <h1 className="text-3xl font-black tracking-tight">{t('Účet „{name}“', { name: child.nickname })}</h1>
        <p className="mt-2 text-sm">
          {t('Stav:')}{' '}
          {child.parentConsentAt ? (
            <strong className="text-green-700 dark:text-green-400">
              {t('souhlas udělen {date} ({name})', { date: child.parentConsentAt.toLocaleDateString(LOCALE_INFO[locale].intl), name: child.parentConsentName ?? '' })}
            </strong>
          ) : (
            <strong className="text-yellow-700 dark:text-yellow-400">{t('čeká na váš souhlas')}</strong>
          )}
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-4 text-lg font-bold">{t('Co dítě zadalo')}</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-slate-500">{t('Přezdívka (veřejná)')}</dt>
          <dd>{child.nickname}</dd>
          <dt className="text-slate-500">{t('E-mail dítěte (neveřejný)')}</dt>
          <dd>{child.email}</dd>
          <dt className="text-slate-500">{t('Narození (neveřejné)')}</dt>
          <dd>
            {child.birthMonth}/{child.birthYear}
          </dd>
          <dt className="text-slate-500">{t('Země, kraj, město (veřejné)')}</dt>
          <dd>{[t(COUNTRY_LABEL[child.country]), child.region, child.city].filter(Boolean).join(', ')}</dd>
          <dt className="text-slate-500">{t('Odkazy')}</dt>
          <dd className="space-y-1">
            {links.length
              ? links.map(([k, v]) => (
                  <a key={k} href={v} target="_blank" rel="noopener noreferrer nofollow" className="block break-all underline">
                    {k}: {v}
                  </a>
                ))
              : t('žádné')}
          </dd>
        </dl>
        <div className="mt-5 space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <p>
            <strong>{t('Jak web funguje:')}</strong>{' '}
            {t('dítě si eviduje sbírku karet a může nabídnout karty k výměně, prodeji nebo darování. Na webu není chat. Když se dva uživatelé shodnou na výměně, zpřístupní se jim navzájem e-mail a domluví se sami. Web neřeší peníze ani doručení.')}
          </p>
          <p>{t('O každé nabídce, kterou dítě dostane nebo pošle, vám přijde kopie e-mailu.')}</p>
        </div>
      </section>

      {!child.parentConsentAt ? (
        <section className="rounded-2xl border border-yellow-300 bg-yellow-50 p-5 dark:border-yellow-500/30 dark:bg-yellow-400/5">
          <h2 className="mb-4 text-lg font-bold">{t('Souhlas zákonného zástupce')}</h2>
          <ActionForm action={giveConsent}>
            <input type="hidden" name="token" value={token} />
            <Field label={t('Vaše jméno a příjmení')}>
              <input name="parentName" required minLength={3} maxLength={80} className={inputCls} />
            </Field>
            <Checkbox name="indexable">{t('Profil dítěte smí být k nalezení přes Google (doporučujeme nechat vypnuté).')}</Checkbox>
            <Checkbox name="confirm">
              {t('Jsem zákonný zástupce dítěte a souhlasím se zpracováním jeho osobních údajů podle')}{' '}
              <a href="/soukromi" target="_blank" className="underline">
                {t('zásad ochrany osobních údajů')}
              </a>
              .
            </Checkbox>
            <Submit>{t('Udělit souhlas')}</Submit>
          </ActionForm>
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 text-lg font-bold">{t('Nastavení')}</h2>
          <ActionForm action={updateParentSettings}>
            <input type="hidden" name="token" value={token} />
            <Checkbox name="indexable" defaultChecked={child.indexable}>
              {t('Profil smí být k nalezení přes Google')}
            </Checkbox>
            {links.length > 0 && (
              <>
                <Checkbox name="approveLinks" defaultChecked={!!child.linksApprovedAt}>
                  {t('Schvaluji zobrazení odkazů výše na profilu')}
                </Checkbox>
                <Checkbox name="clearLinks">{t('Odkazy smazat')}</Checkbox>
              </>
            )}
            {child.city && <Checkbox name="clearCity">{t('Smazat město z profilu (kraj zůstane)')}</Checkbox>}
            <Submit>{t('Uložit nastavení')}</Submit>
          </ActionForm>
          <div className="mt-6 border-t border-slate-200 pt-5 dark:border-slate-800">
            <ActionForm action={revokeConsent}>
              <input type="hidden" name="token" value={token} />
              <p className="text-sm text-slate-500">
                {t('Odvoláním souhlasu se účet znovu omezí (profil skrytý, žádné nabídky) a dítě se odhlásí.')}
              </p>
              <Submit variant="ghost">{t('Odvolat souhlas')}</Submit>
            </ActionForm>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-red-200 p-5 dark:border-red-500/30">
        <h2 className="text-lg font-bold">{t('Smazat účet dítěte')}</h2>
        <p className="mb-4 mt-1 text-sm text-slate-500">{t('Smaže profil, sbírku i všechny údaje. Nejde vrátit.')}</p>
        <ActionForm action={parentDeleteAccount}>
          <input type="hidden" name="token" value={token} />
          <Field label={t('Pro potvrzení opište přezdívku: {name}', { name: child.nickname })}>
            <input name="confirmNick" required className={inputCls} />
          </Field>
          <Submit variant="danger">{t('Smazat účet')}</Submit>
        </ActionForm>
      </section>

      <p className="text-xs text-slate-500">
        {t('Tento odkaz si uschovejte, slouží ke správě účtu. Nikomu ho neposílejte. Dotazy:')} <a href="mailto:pokemon@jede.online" className="underline">pokemon@jede.online</a>
      </p>
    </main>
  )
}
