import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Bezpečný obchod',
  description: 'Jak bezpečně vyměnit, prodat nebo koupit Pokémon karty: balení, platby, padělky a co dělat při podvodu.',
}

const box = 'rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900'

export default function SafeTradePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-black tracking-tight">Bezpečný obchod</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-300">
        Pár jednoduchých pravidel, aby výměna nebo prodej dopadly dobře. Děti: projděte si to s rodičem.
      </p>

      <div className="mt-8 space-y-5">
        <section className={box}>
          <h2 className="text-xl font-bold">📦 Jak kartu zabalit</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5">
            <li>Kartu dej do <strong>obalu (sleeve)</strong> a pak do <strong>pevného pouzdra (toploader)</strong>.</li>
            <li>Pouzdro vlož mezi dva kousky kartonu nebo do bublinkové obálky, aby se neohnulo.</li>
            <li>Posílej <strong>se sledováním zásilky</strong> (Zásilkovna, Balíkovna, Česká pošta). Číslo zásilky pošli druhé straně.</li>
            <li>Dražší kartu vyfoť před zabalením — pomůže to, kdyby nastal spor.</li>
          </ul>
        </section>

        <section className={box}>
          <h2 className="text-xl font-bold">💳 Placení</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5">
            <li>
              Nejbezpečnější je <strong>osobní předání</strong> na veřejném místě (u dětí s rodičem) nebo dobírka.
            </li>
            <li>
              U PayPalu plať jako <strong>„Zboží a služby“</strong>. Platba „Přátelům a rodině“ nemá ochranu kupujícího — o peníze
              můžeš přijít.
            </li>
            <li>Neposílej peníze předem neznámému člověku bez hodnocení. Podívej se na jeho hodnocení a dokončené výměny.</li>
            <li>Nikdy nikomu neposílej hesla, kódy z SMS ani údaje z platební karty.</li>
          </ul>
        </section>

        <section className={box}>
          <h2 className="text-xl font-bold">🔍 Jak poznat padělek</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5">
            <li>Podezřele nízká cena (balíček boosterů „za stovku“, vzácná karta za pár korun).</li>
            <li>Lesklý nebo naopak matný povrch, jiné barvy, rozmazaný text, chyby v textu, špatné písmo.</li>
            <li>Karta je tenčí nebo ohebnější než tvoje originální. Originály mají uvnitř tenkou tmavou vrstvu (je vidět na natržené levné kartě), padělky ji obvykle nemají.</li>
            <li>Rub karty má jiný odstín modré než tvoje originální karty — porovnej je vedle sebe.</li>
          </ul>
        </section>

        <section className={box}>
          <h2 className="text-xl font-bold">🛡️ Pro děti a rodiče</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5">
            <li>Nedomlouvej se s nikým mimo web bez vědomí rodičů a nesdílej adresu školy ani bydliště veřejně.</li>
            <li>Když ti něco nesedí nebo se někdo chová divně, řekni to rodičům a uživatele <strong>nahlaš</strong> (odkaz „Nahlásit“ na jeho profilu).</li>
            <li>Rodiče dostávají kopie e-mailů o poptávkách a mohou účet dítěte spravovat přes odkaz ze souhlasu.</li>
          </ul>
        </section>

        <section className={box}>
          <h2 className="text-xl font-bold">🚨 Když se něco pokazí</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5">
            <li>Nejdřív se zkus s druhou stranou slušně domluvit (zásilka se mohla zpozdit).</li>
            <li>Uživatele <strong>nahlaš</strong> a dej mu férové hodnocení.</li>
            <li>Při podvodu se obrať na <strong>Policii ČR / SR</strong> — schovej si zprávy, potvrzení o platbě a číslo zásilky.</li>
            <li>
              Web jen zprostředkovává kontakt a za obchody mezi uživateli neodpovídá (viz{' '}
              <Link href="/soukromi" className="underline">
                pravidla
              </Link>
              ).
            </li>
          </ul>
        </section>
      </div>
    </main>
  )
}
