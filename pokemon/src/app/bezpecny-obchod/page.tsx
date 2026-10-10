import type { Metadata } from 'next'
import Link from 'next/link'
import { getT } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return {
    title: t('Bezpečný obchod'),
    description: t('Jak bezpečně vyměnit, prodat nebo koupit Pokémon karty: balení, platby, padělky a co dělat při podvodu.'),
  }
}

const box = 'rounded-panel border border-line bg-card p-5'

export default async function SafeTradePage() {
  const t = await getT()
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-black tracking-tight">{t('Bezpečný obchod')}</h1>
      <p className="mt-2 text-muted">
        {t('Pár jednoduchých pravidel, aby výměna nebo prodej dopadly dobře. Děti: projděte si to s rodičem.')}
      </p>

      <div className="mt-8 space-y-5">
        <section className={box}>
          <h2 className="text-xl font-bold">📦 {t('Jak kartu zabalit')}</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5">
            <li>{t('Kartu dej do')} <strong>{t('obalu (sleeve)')}</strong> {t('a pak do')} <strong>{t('pevného pouzdra (toploader)')}</strong>.</li>
            <li>{t('Pouzdro vlož mezi dva kousky kartonu nebo do bublinkové obálky, aby se neohnulo.')}</li>
            <li>{t('Posílej')} <strong>{t('se sledováním zásilky')}</strong> {t('(Zásilkovna, Balíkovna, Česká pošta). Číslo zásilky pošli druhé straně.')}</li>
            <li>{t('Dražší kartu vyfoť před zabalením — pomůže to, kdyby nastal spor.')}</li>
          </ul>
        </section>

        <section className={box}>
          <h2 className="text-xl font-bold">💳 {t('Placení')}</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5">
            <li>
              {t('Nejbezpečnější je')} <strong>{t('osobní předání')}</strong>{' '}
              {t('na veřejném místě (u dětí s rodičem) nebo dobírka.')}
            </li>
            <li>
              {t('U PayPalu plať jako')} <strong>{t('„Zboží a služby“')}</strong>.{' '}
              {t('Platba „Přátelům a rodině“ nemá ochranu kupujícího — o peníze můžeš přijít.')}
            </li>
            <li>{t('Neposílej peníze předem neznámému člověku bez hodnocení. Podívej se na jeho hodnocení a dokončené výměny.')}</li>
            <li>{t('Nikdy nikomu neposílej hesla, kódy z SMS ani údaje z platební karty.')}</li>
          </ul>
        </section>

        <section className={box}>
          <h2 className="text-xl font-bold">🔍 {t('Jak poznat padělek')}</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5">
            <li>{t('Podezřele nízká cena (balíček boosterů „za stovku“, vzácná karta za pár korun).')}</li>
            <li>{t('Lesklý nebo naopak matný povrch, jiné barvy, rozmazaný text, chyby v textu, špatné písmo.')}</li>
            <li>{t('Karta je tenčí nebo ohebnější než tvoje originální. Originály mají uvnitř tenkou tmavou vrstvu (je vidět na natržené levné kartě), padělky ji obvykle nemají.')}</li>
            <li>{t('Rub karty má jiný odstín modré než tvoje originální karty — porovnej je vedle sebe.')}</li>
          </ul>
        </section>

        <section className={box}>
          <h2 className="text-xl font-bold">🛡️ {t('Pro děti a rodiče')}</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5">
            <li>{t('Nedomlouvej se s nikým mimo web bez vědomí rodičů a nesdílej adresu školy ani bydliště veřejně.')}</li>
            <li>{t('Když ti něco nesedí nebo se někdo chová divně, řekni to rodičům a uživatele')} <strong>{t('nahlaš')}</strong> {t('(odkaz „Nahlásit“ na jeho profilu).')}</li>
            <li>{t('Rodiče dostávají kopie e-mailů o výměnách a mohou účet dítěte spravovat přes odkaz ze souhlasu.')}</li>
          </ul>
        </section>

        <section className={box}>
          <h2 className="text-xl font-bold">🚨 {t('Když se něco pokazí')}</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5">
            <li>{t('Nejdřív se zkus s druhou stranou slušně domluvit (zásilka se mohla zpozdit).')}</li>
            <li>{t('Uživatele')} <strong>{t('nahlaš')}</strong> {t('a dej mu férové hodnocení.')}</li>
            <li>{t('Při podvodu se obrať na')} <strong>{t('Policii ČR / SR')}</strong> {t('— schovej si zprávy, potvrzení o platbě a číslo zásilky.')}</li>
            <li>
              {t('Web jen zprostředkovává kontakt a za obchody mezi uživateli neodpovídá (viz')}{' '}
              <Link href="/soukromi" className="underline">
                {t('pravidla')}
              </Link>
              ).
            </li>
          </ul>
        </section>
      </div>
    </main>
  )
}
