'use client'

import { useEffect, useRef } from 'react'
import { openModal } from '@/lib/openModal'

const EXCEL_BULLETS = [
  { title: 'Transformace dat', desc: 'Uděláme z chaotických tabulek přehledný online nástroj.' },
  { title: 'Uživatelská práva', desc: 'Každý uvidí jen to, co má — zaměstnanec, manažer i klient.' },
  { title: 'Přístup odkudkoliv', desc: 'Plná funkčnost v prohlížeči na PC, tabletu i mobilu bez instalace.' },
]

const WEB_BULLETS = [
  { title: 'Firemní prezentace', desc: 'Moderní vizitky a weby, které udělají špičkový první dojem.' },
  { title: 'Prodejní Landing Pages', desc: 'Jednostránkové weby vyladěné pro maximální konverze.' },
  { title: 'Blesková rychlost a čistý kód', desc: 'Žádné šablony. Web bude rychlý, bezpečný a optimalizovaný pro vyhledávače.' },
]

function Bullet({ title, desc }: { title: string; desc: string }) {
  return (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
      <span style={{
        marginTop: '0.3rem', flexShrink: 0,
        width: '5px', height: '5px', borderRadius: '50%',
        background: 'var(--accent-gold)',
        boxShadow: '0 0 6px rgba(201,169,97,0.5)',
      }} />
      <div>
        <span style={{
          fontFamily: '"Clash Display", system-ui, sans-serif',
          fontWeight: 500, fontSize: '0.9375rem',
          color: 'var(--text-primary)', letterSpacing: '-0.01em',
        }}>
          {title}:&nbsp;
        </span>
        <span style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)', lineHeight: 1.65 }}>
          {desc}
        </span>
      </div>
    </div>
  )
}

export function Services() {
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const items = sectionRef.current?.querySelectorAll<HTMLElement>('.srv-reveal')
    if (!items) return
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in-view'); observer.unobserve(e.target) } }),
      { threshold: 0.1 }
    )
    items.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <section
      ref={sectionRef}
      style={{
        padding: '8rem 1.5rem',
        background: 'var(--bg-elevated)',
        borderTop: '1px solid var(--border-subtle)',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        {/* Section header */}
        <div className="reveal srv-reveal" style={{ marginBottom: '4rem', textAlign: 'center' }}>
          <span style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '0.75rem', color: 'var(--accent-gold)',
            letterSpacing: '0.12em', textTransform: 'uppercase',
            display: 'block', marginBottom: '1.25rem',
          }}>
            Naše služby
          </span>
          <h2 style={{
            fontFamily: '"Clash Display", system-ui, sans-serif',
            fontSize: 'clamp(2rem, 4vw, 3rem)',
            fontWeight: 600, color: 'var(--text-primary)',
            letterSpacing: '-0.02em', lineHeight: 1.15,
          }}>
            Zvolte si svou cestu.
          </h2>
        </div>

        {/* Two columns */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1.5rem',
        }}>
          {/* ── Sloupec A: Excel → App ── */}
          <div
            className="reveal srv-reveal"
            style={{
              border: '1px solid rgba(201,169,97,0.2)',
              borderRadius: '12px',
              padding: '2.5rem',
              background: 'rgba(201,169,97,0.03)',
              display: 'flex', flexDirection: 'column',
              transition: 'border-color 0.25s',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(201,169,97,0.4)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(201,169,97,0.2)')}
          >
            <span style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '0.6875rem', color: 'var(--accent-gold)',
              letterSpacing: '0.12em', textTransform: 'uppercase',
              marginBottom: '1.25rem', display: 'block',
            }}>
              01 — Excel → Aplikace
            </span>
            <h3 style={{
              fontFamily: '"Clash Display", system-ui, sans-serif',
              fontSize: 'clamp(1.375rem, 2.5vw, 1.75rem)',
              fontWeight: 600, color: 'var(--text-primary)',
              letterSpacing: '-0.02em', lineHeight: 1.2,
              marginBottom: '0.75rem',
            }}>
              Chytré aplikace z Excelu
            </h3>
            <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '2rem' }}>
              Překlopíme vaše tabulky do zabezpečeného systému.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem', flex: 1 }}>
              {EXCEL_BULLETS.map(b => <Bullet key={b.title} {...b} />)}
            </div>

            <button
              className="btn-gold"
              onClick={() => openModal('Mám zájem o aplikaci z Excelu')}
              style={{ marginTop: '2.5rem', width: '100%', fontSize: '0.875rem' }}
            >
              Chci aplikaci z Excelu →
            </button>
          </div>

          {/* ── Sloupec B: Web na míru ── */}
          <div
            className="reveal srv-reveal"
            style={{
              transitionDelay: '80ms',
              border: '1px solid rgba(201,169,97,0.2)',
              borderRadius: '12px',
              padding: '2.5rem',
              background: 'rgba(201,169,97,0.03)',
              display: 'flex', flexDirection: 'column',
              transition: 'border-color 0.25s',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(201,169,97,0.4)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(201,169,97,0.2)')}
          >
            <span style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '0.6875rem', color: 'var(--accent-gold)',
              letterSpacing: '0.12em', textTransform: 'uppercase',
              marginBottom: '1.25rem', display: 'block',
            }}>
              02 — Web na míru
            </span>
            <h3 style={{
              fontFamily: '"Clash Display", system-ui, sans-serif',
              fontSize: 'clamp(1.375rem, 2.5vw, 1.75rem)',
              fontWeight: 600, color: 'var(--text-primary)',
              letterSpacing: '-0.02em', lineHeight: 1.2,
              marginBottom: '0.75rem',
            }}>
              Reprezentativní weby na míru
            </h3>
            <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '2rem' }}>
              Navrhneme a naprogramujeme web, který vám získá zákazníky.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem', flex: 1 }}>
              {WEB_BULLETS.map(b => <Bullet key={b.title} {...b} />)}
            </div>

            <button
              className="btn-gold"
              onClick={() => openModal('Mám zájem o webové stránky')}
              style={{ marginTop: '2.5rem', width: '100%', fontSize: '0.875rem' }}
            >
              Chci nový web na klíč →
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
