import type { Metadata } from 'next'
import { Footer } from '@/components/Footer'

export const metadata: Metadata = {
  title: 'Podmínky použití — jede.online',
  description: 'Obchodní podmínky a zásady ochrany osobních údajů služby jede.online.',
}

const SECTIONS = [
  {
    title: '1. Základní informace',
    content: `Provozovatelem služby jede.online je fyzická nebo právnická osoba uvedená v kontaktních údajích níže. Služba spočívá v analýze datových podkladů (tabulky, Excel soubory) a vývoji webových aplikací na míru dle požadavků klienta.`,
  },
  {
    title: '2. Rozsah služby',
    content: `Bezplatná konzultace zahrnuje analýzu podkladů a nezávazný návrh řešení. Vývoj aplikace je placená služba s individuální cenovou nabídkou. Rozsah, cena a termíny jsou vždy upřesněny ve smlouvě nebo objednávce před zahájením prací.`,
  },
  {
    title: '3. Ochrana osobních údajů',
    content: `Při vyplnění kontaktního formuláře zpracováváme pouze váš e-mail za účelem komunikace a zaslání potvrzení. Data nepředáváme třetím stranám. E-mailová adresa je uložena v zabezpečené databázi a slouží výhradně k reakci na váš dotaz. Souhlas s uchováním můžete kdykoli odvolat na info@jede.online.`,
  },
  {
    title: '4. Platební podmínky',
    content: `Cena za vývoj je dohodnuta individuálně před zahájením projektu. Fakturace probíhá na základě odsouhlasené nabídky. Není-li dohodnuto jinak, splatnost faktur je 14 dní od vystavení.`,
  },
  {
    title: '5. Odpovědnost',
    content: `Poskytovatel neodpovídá za škody vzniklé nesprávným použitím dodané aplikace nebo za výpadky třetích stran (hosting, databáze, e-mailové služby). Klient je odpovědný za správnost a úplnost podkladů předaných k analýze.`,
  },
  {
    title: '6. Změny podmínek',
    content: `Poskytovatel si vyhrazuje právo tyto podmínky jednostranně změnit. Aktuální verze je vždy dostupná na této stránce. Pokračováním v používání služby po zveřejnění změn klient vyjadřuje souhlas s novým zněním.`,
  },
  {
    title: '7. Kontakt',
    content: `Dotazy k podmínkám nebo žádosti o výmaz dat zasílejte na: info@jede.online`,
  },
]

export default function Podminky() {
  return (
    <>
      {/* Navbar placeholder — simple header */}
      <header
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          background: 'rgba(5,5,8,0.95)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <div
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            padding: '0 2rem',
            height: '64px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <a
            href="/"
            style={{
              fontFamily: '"Clash Display", system-ui, sans-serif',
              fontSize: '1.125rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              textDecoration: 'none',
              letterSpacing: '-0.02em',
            }}
          >
            jede<span style={{ color: 'var(--accent-gold)' }}>.</span>online
          </a>
        </div>
      </header>

      <main
        style={{
          paddingTop: '64px',
          minHeight: '100vh',
          background: 'var(--bg-base)',
        }}
      >
        <div
          style={{
            maxWidth: '720px',
            margin: '0 auto',
            padding: '6rem 1.5rem 8rem',
          }}
        >
          {/* Header */}
          <div style={{ marginBottom: '4rem' }}>
            <span
              style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: '0.75rem',
                color: 'var(--accent-gold)',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                display: 'block',
                marginBottom: '1.5rem',
              }}
            >
              Právní informace
            </span>
            <h1
              style={{
                fontFamily: '"Clash Display", system-ui, sans-serif',
                fontSize: 'clamp(2rem, 4vw, 2.75rem)',
                fontWeight: 600,
                color: 'var(--text-primary)',
                letterSpacing: '-0.02em',
                lineHeight: 1.15,
                marginBottom: '1rem',
              }}
            >
              Podmínky použití.
            </h1>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              Platné od 19. 5. 2026
            </p>
          </div>

          {/* Sections */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
            {SECTIONS.map(section => (
              <div
                key={section.title}
                style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '2rem' }}
              >
                <h2
                  style={{
                    fontFamily: '"Clash Display", system-ui, sans-serif',
                    fontSize: '1.125rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    letterSpacing: '-0.01em',
                    marginBottom: '1rem',
                  }}
                >
                  {section.title}
                </h2>
                <p
                  style={{
                    fontSize: '0.9375rem',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.8,
                  }}
                >
                  {section.content}
                </p>
              </div>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </>
  )
}
