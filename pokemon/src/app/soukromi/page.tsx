import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Pravidla a ochrana osobních údajů' }

// NÁVRH pro zkušební provoz. Před veřejným spuštěním nechat zkontrolovat právníkem.
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <p className="mb-6 rounded-xl bg-yellow-50 px-4 py-3 text-sm text-yellow-900 dark:bg-yellow-400/10 dark:text-yellow-100">
        Zkušební provoz. Pracovní verze pravidel, konečné znění doplníme před ostrým spuštěním.
      </p>
      <article className="space-y-6 leading-relaxed [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc">
        <h1 className="text-3xl font-black tracking-tight">Pravidla a ochrana osobních údajů</h1>

        <h2>Kdo web provozuje</h2>
        <p>
          Web pokemon.jede.online je nekomerční komunitní projekt ve zkušebním provozu. Nic se na něm neprodává a
          provozovatel z něj nemá žádný příjem. Kontakt na provozovatele: <a href="mailto:pokemon@jede.online" className="underline">pokemon@jede.online</a>.
        </p>

        <h2>Jaké údaje zpracováváme a proč</h2>
        <ul>
          <li>E-mail a heslo (uložené jen jako otisk): přihlášení, obnova hesla a upozornění na nabídky.</li>
          <li>Přezdívka, kraj, město a odkazy na sociální sítě: veřejný profil, aby se sběratelé mohli najít.</li>
          <li>
            Telefon (nepovinný, jen dospělí): zobrazí se pouze přihlášeným uživatelům s ověřeným e-mailem po kliknutí.
            Zaznamenáváme, kdo si číslo zobrazil (ochrana proti zneužití); smazáním čísla v Můj účet z webu zmizí.
          </li>
          <li>Rok a měsíc narození a země: zjištění, zda je potřeba souhlas rodiče. Nezveřejňujeme.</li>
          <li>E-mail rodiče a jméno, které uvedl při souhlasu (u dětí): souhlas a správa účtu dítěte.</li>
          <li>Sbírka karet a nabídky: hlavní funkce webu.</li>
        </ul>
        <p>
          <strong>Kontaktní údaje (e-mail, telefon, e-mail rodiče) neposkytujeme, neprodáváme ani nepronajímáme třetím
          stranám</strong> a nepoužíváme je k reklamě. Ostatní uživatelé uvidí kontakt jen v rozsahu, který sami zvolíte:
          e-mail po přijetí konkrétní žádosti o výměnu a telefon (pokud ho vyplníte) po kliknutí na „Zobrazit číslo“. E-maily
          technicky odesíláme přes službu Brevo, která je smí použít jen k doručení zprávy. Údaje bychom vydali jen tehdy,
          kdyby to ukládal zákon (např. na žádost policie nebo soudu).
        </p>

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

        <h2>Odpovědnost provozovatele</h2>
        <ul>
          <li>
            Web je jen nástroj, přes který se sběratelé najdou a domluví. Provozovatel není stranou žádné výměny, prodeje
            ani daru a nevstupuje do domluvy mezi uživateli.
          </li>
          <li>
            Za obsah nabídek (popis, stav a pravost karet, ceny) odpovídá výhradně uživatel, který je zveřejnil. Provozovatel
            nabídky předem nekontroluje.
          </li>
          <li>
            Provozovatel neodpovídá za průběh ani výsledek domluvených obchodů, za platby, poštovné, ztrátu či poškození
            zásilky, nedodání, padělky ani za jednání jiných uživatelů. Případné spory řeší uživatelé mezi sebou (u dětí
            jejich zákonní zástupci).
          </li>
          <li>
            Hodnocení a údaje v profilech zadávají uživatelé; provozovatel neručí za jejich pravdivost.
          </li>
          <li>
            Web je poskytován zdarma a „tak, jak je“, bez záruky nepřetržité dostupnosti. Provozovatel neodpovídá za ztrátu
            dat ani škody vzniklé jeho používáním, nedostupností nebo chybou v katalogu či cenách.
          </li>
          <li>
            Podezření na podvod nebo porušení pravidel nahlaste přes „Nahlásit“ u uživatele. Provozovatel může nabídku
            skrýt nebo účet zablokovat, není to ale jeho povinnost ani záruka. Při podvodu se obraťte na Policii ČR / SR.
          </li>
        </ul>

        <h2>Ceny karet</h2>
        <p>
          Ceny u karet jsou orientační cenové trendy z Cardmarketu. Skutečná hodnota se liší podle stavu karty a nabídky; ceny
          nejsou nabídkou ani doporučením.
        </p>

        <h2>Vaše práva</h2>
        <p>
          Máte právo na přístup k údajům, opravu, výmaz (účet smažete sami na stránce Můj účet), omezení zpracování a
          podání stížnosti u Úřadu pro ochranu osobních údajů (ČR) nebo Úradu na ochranu osobných údajov (SR).
        </p>

        <h2>Cookies</h2>
        <p>
          Používáme jen nezbytnou cookie pro přihlášení. Žádné reklamní ani analytické cookies. Návštěvnost počítáme vlastním
          jednoduchým počítadlem bez cookies: ukládá se jen denní počet zobrazení stránek a anonymní otisk návštěvníka (nejde
          z něj zjistit, kdo jste), který po 60 dnech mažeme. Nic se nepředává třetím stranám.
        </p>
      </article>
    </main>
  )
}
