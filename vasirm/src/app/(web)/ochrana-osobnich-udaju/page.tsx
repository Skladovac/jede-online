import type { Metadata } from 'next'
import { PageHero } from '@/components/ui'
import { SITE } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Ochrana osobních údajů',
  description: 'Jak zpracováváme osobní údaje z formulářů na webu Vaši realitní makléři.',
  alternates: { canonical: '/ochrana-osobnich-udaju' },
}

// TODO(Ondřej): doplnit IČO a sídlo správce do lib/site.ts a nechat text zkontrolovat.

export default function PrivacyPage() {
  const op = SITE.operator
  return (
    <>
      <PageHero label="Informace" title="Ochrana osobních údajů" />
      <section className="bg-paper py-16 md:py-24">
        <div className="wrap">
          <div className="prose-vrm max-w-3xl [&_h2]:mb-3 [&_h2]:mt-12 [&_h2]:font-serif [&_h2]:text-[2rem] [&_h2]:leading-tight [&_li]:mb-2 [&_li]:leading-relaxed [&_li]:text-ink/85 [&_ul]:mb-5 [&_ul]:list-disc [&_ul]:pl-6">
            <h2>Kdo je správce</h2>
            <p>
              Správcem osobních údajů je {op.name}
              {op.ico ? `, IČO ${op.ico}` : ''}
              {op.address ? `, ${op.address}` : ''} (dále „my“). S dotazy k ochraně údajů se na nás obracejte na e-mailu{' '}
              <a className="link-u" href={`mailto:${SITE.email}`}>
                {SITE.email}
              </a>
              .
            </p>

            <h2>Jaké údaje zpracováváme a proč</h2>
            <p>Údaje zpracováváme jen tehdy, když nám je sami pošlete přes formulář na webu, e-mailem nebo telefonem:</p>
            <ul>
              <li>
                <strong>Kontaktní údaje</strong> — jméno, telefon, e-mail — abychom vám mohli odpovědět.
              </li>
              <li>
                <strong>Obsah poptávky</strong> — zpráva, zájem o prohlídku, údaje o nemovitosti pro odhad ceny (typ, lokalita, velikost,
                stav).
              </li>
            </ul>
            <p>
              Právním základem je jednání o smlouvě na vaši žádost a náš oprávněný zájem odpovědět na dotaz, který jste nám poslali.
              Údaje nepoužíváme k zasílání reklamy a nepředáváme je dalším firmám k jejich vlastním účelům.
            </p>

            <h2>Jak dlouho údaje uchováváme</h2>
            <p>
              Po dobu nezbytnou k vyřízení poptávky a navazující spolupráce. Poptávky, ze kterých spolupráce nevznikne, mažeme nejpozději
              3 roky od posledního kontaktu.
            </p>

            <h2>Kdo k údajům má přístup</h2>
            <p>K údajům mají přístup jen makléři VRM. Při provozu webu využíváme tyto zpracovatele:</p>
            <ul>
              <li>Hetzner Online GmbH (Německo) — server, na kterém web a databáze běží.</li>
              <li>Sendinblue SAS / Brevo (Francie) — odeslání upozornění na novou poptávku do naší e-mailové schránky.</li>
            </ul>

            <h2>Cookies, měření návštěvnosti a mapy</h2>
            <p>
              Web nepoužívá analytické ani reklamní cookies. Jediná cookie slouží k přihlášení makléřů do administrace. Mapa u nemovitosti
              se načítá ze služby Google až poté, co na ni kliknete — teprve tehdy se váš prohlížeč spojí se servery Googlu.
            </p>
            <p>
              Návštěvnost měříme vlastním jednoduchým počítadlem na našem serveru, bez cookies a bez služeb třetích stran. Ukládáme jen
              denní počty zobrazení stránek, odkud návštěvníci přišli (např. z vyhledávače) a anonymní denní otisk prohlížeče, ze kterého
              nelze zjistit, kdo jste. Činíme tak na základě oprávněného zájmu zlepšovat web.
            </p>

            <h2>Vaše práva</h2>
            <p>
              Máte právo na přístup ke svým údajům, jejich opravu nebo výmaz, omezení zpracování a vznesení námitky. Stačí nám napsat na{' '}
              <a className="link-u" href={`mailto:${SITE.email}`}>
                {SITE.email}
              </a>
              . Pokud se domníváte, že s údaji nakládáme v rozporu s předpisy, můžete se obrátit na Úřad pro ochranu osobních údajů
              (uoou.gov.cz).
            </p>
          </div>
        </div>
      </section>
    </>
  )
}
