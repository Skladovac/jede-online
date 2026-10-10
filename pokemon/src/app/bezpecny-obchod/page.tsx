import type { Metadata } from 'next'
import Link from 'next/link'
import { getT } from '@/lib/i18n/server'
import { panel } from '@/components/design'
import { AlertTriangle, CreditCard, Package, Search, ShieldCheck, type LucideIcon } from 'lucide-react'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return {
    title: t('Bezpečný obchod'),
    description: t('Jak bezpečně vyměnit, prodat nebo koupit Pokémon karty: balení, platby, padělky a co dělat při podvodu.'),
  }
}

const box = `${panel} p-5 sm:p-6`

/** Nadpis sekce s malou ikonou v inkoustovém čtverečku. */
function H2({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-3 text-xl font-bold text-fg">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-[var(--ink)] text-brand-yellow dark:bg-brand-yellow dark:text-[var(--ink)]">
        <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
      </span>
      {children}
    </h2>
  )
}

export default async function SafeTradePage() {
  const t = await getT()
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-4xl font-extrabold text-fg sm:text-[44px]">{t('Bezpečný obchod')}</h1>
      <p className="mt-2 text-muted">
        {t('Pár jednoduchých pravidel, aby výměna nebo prodej dopadly dobře. Děti: projděte si to s rodičem.')}
      </p>

      <div className="mt-8 space-y-5">
        <section className={box}>
          <H2 icon={Package}>{t('Jak kartu zabalit')}</H2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-fg marker:text-subtle">
            <li>{t('Kartu dej do')} <strong>{t('obalu (sleeve)')}</strong> {t('a pak do')} <strong>{t('pevného pouzdra (toploader)')}</strong>.</li>
            <li>{t('Pouzdro vlož mezi dva kousky kartonu nebo do bublinkové obálky, aby se neohnulo.')}</li>
            <li>{t('Posílej')} <strong>{t('se sledováním zásilky')}</strong> {t('(Zásilkovna, Balíkovna, Česká pošta). Číslo zásilky pošli druhé straně.')}</li>
            <li>{t('Dražší kartu vyfoť před zabalením — pomůže to, kdyby nastal spor.')}</li>
          </ul>
        </section>

        <section className={box}>
          <H2 icon={CreditCard}>{t('Placení')}</H2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-fg marker:text-subtle">
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
          <H2 icon={Search}>{t('Jak poznat padělek')}</H2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-fg marker:text-subtle">
            <li>{t('Podezřele nízká cena (balíček boosterů „za stovku“, vzácná karta za pár korun).')}</li>
            <li>{t('Lesklý nebo naopak matný povrch, jiné barvy, rozmazaný text, chyby v textu, špatné písmo.')}</li>
            <li>{t('Karta je tenčí nebo ohebnější než tvoje originální. Originály mají uvnitř tenkou tmavou vrstvu (je vidět na natržené levné kartě), padělky ji obvykle nemají.')}</li>
            <li>{t('Rub karty má jiný odstín modré než tvoje originální karty — porovnej je vedle sebe.')}</li>
          </ul>
        </section>

        <section className={box}>
          <H2 icon={ShieldCheck}>{t('Pro děti a rodiče')}</H2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-fg marker:text-subtle">
            <li>{t('Nedomlouvej se s nikým mimo web bez vědomí rodičů a nesdílej adresu školy ani bydliště veřejně.')}</li>
            <li>{t('Když ti něco nesedí nebo se někdo chová divně, řekni to rodičům a uživatele')} <strong>{t('nahlaš')}</strong> {t('(odkaz „Nahlásit“ na jeho profilu).')}</li>
            <li>{t('Rodiče dostávají kopie e-mailů o výměnách a mohou účet dítěte spravovat přes odkaz ze souhlasu.')}</li>
          </ul>
        </section>

        <section className={box}>
          <H2 icon={AlertTriangle}>{t('Když se něco pokazí')}</H2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-fg marker:text-subtle">
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
