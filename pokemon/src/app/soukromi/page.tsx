import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Pravidla a ochrana osobních údajů' }

// NÁVRH pro uzavřenou betu. Před veřejným spuštěním nechat zkontrolovat právníkem
// a doplnit údaje provozovatele (správce).
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <p className="mb-6 rounded-xl bg-yellow-50 px-4 py-3 text-sm text-yellow-900 dark:bg-yellow-400/10 dark:text-yellow-100">
        Pracovní verze pro uzavřené testování. Konečné znění doplníme před veřejným spuštěním.
      </p>
      <article className="space-y-6 leading-relaxed [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc">
        <h1 className="text-3xl font-black tracking-tight">Pravidla a ochrana osobních údajů</h1>

        <h2>Kdo web provozuje</h2>
        <p>
          Web pokemon.jede.online je neziskový komunitní projekt. Správcem osobních údajů je [DOPLNIT: jméno / název
          a IČO provozovatele], kontakt: info@jede.online.
        </p>

        <h2>Jaké údaje zpracováváme a proč</h2>
        <ul>
          <li>E-mail a heslo (uložené jen jako otisk): přihlášení, obnova hesla a upozornění na nabídky.</li>
          <li>Přezdívka, kraj, město a odkazy na sociální sítě: veřejný profil, aby se sběratelé mohli najít.</li>
          <li>Rok a měsíc narození a země: zjištění, zda je potřeba souhlas rodiče. Nezveřejňujeme.</li>
          <li>E-mail rodiče a jméno, které uvedl při souhlasu (u dětí): souhlas a správa účtu dítěte.</li>
          <li>Sbírka karet a nabídky: hlavní funkce webu.</li>
        </ul>
        <p>Údaje neprodáváme ani nepředáváme třetím stranám. E-maily odesíláme přes službu Resend.</p>

        <h2>Děti</h2>
        <p>
          Uživatelé mladší 15 let (Česko) nebo 16 let (Slovensko) mohou web plně používat jen se souhlasem zákonného
          zástupce. Rodič může souhlas kdykoli odvolat, upravit údaje nebo účet smazat přes odkaz, který dostal e-mailem.
        </p>

        <h2>Bezpečnost a pravidla chování</h2>
        <ul>
          <li>Web nemá chat. Kontakt se zpřístupní až po přijetí konkrétní nabídky.</li>
          <li>Web neřeší platby ani doručení. Za domluvu odpovídají uživatelé (u dětí jejich rodiče).</li>
          <li>Zakázané jsou podvody, urážky, nabízení padělků a cokoli, co neodpovídá popisu karty.</li>
          <li>Nevhodné chování můžete nahlásit. Účty porušující pravidla můžeme zablokovat.</li>
        </ul>

        <h2>Ceny karet</h2>
        <p>
          Ceny u karet jsou orientační průměry z Cardmarketu. Skutečná hodnota se liší podle stavu karty a nabídky; ceny
          nejsou nabídkou ani doporučením.
        </p>

        <h2>Vaše práva</h2>
        <p>
          Máte právo na přístup k údajům, opravu, výmaz (účet smažete sami na stránce Můj účet), omezení zpracování a
          podání stížnosti u Úřadu pro ochranu osobních údajů (ČR) nebo Úradu na ochranu osobných údajov (SR).
        </p>

        <h2>Cookies</h2>
        <p>Používáme jen nezbytnou cookie pro přihlášení. Žádné reklamní ani analytické cookies.</p>
      </article>
    </main>
  )
}
