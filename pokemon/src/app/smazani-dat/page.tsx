import type { Metadata } from 'next'
import Link from 'next/link'
import { getT } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t('Smazání údajů') }
}

/** Pokyny ke smazání dat (Facebook vyžaduje odkaz „Data deletion instructions“). */
export default async function DataDeletionPage() {
  const t = await getT()
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-black tracking-tight">{t('Smazání údajů')}</h1>
      <div className="mt-6 space-y-4 leading-relaxed">
        <p>{t('Svůj účet a všechna data (profil, sbírku, nabídky, hodnocení i propojení s Google nebo Facebookem) smažeš sám:')}</p>
        <ol className="list-decimal space-y-1 pl-6">
          <li>
            {t('Přihlas se a otevři')}{' '}
            <Link href="/ucet" className="underline">
              {t('Můj účet')}
            </Link>
            .
          </li>
          <li>{t('Dole v části „Smazat účet“ potvrď smazání.')}</li>
        </ol>
        <p>
          {t('Pokud ses přihlašoval jen přes Google nebo Facebook a nemáš heslo, nastav si ho přes „Zapomenuté heslo“, nebo nám napiš na')}{' '}
          <a href="mailto:pokemon@jede.online" className="underline">
            pokemon@jede.online
          </a>{' '}
          {t('a účet smažeme do 30 dnů.')}
        </p>
        <p>{t('Účet dítěte může smazat i rodič přes odkaz, který dostal e-mailem.')}</p>
      </div>
    </main>
  )
}
