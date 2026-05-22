'use client'

import { useEffect, useRef } from 'react'

const PAIN_POINTS = [
  { num: '01', text: 'Pět verzí jednoho souboru a každý v týmu pracuje s tou svojí.' },
  { num: '02', text: 'Sdílíme citlivá data s klienty, ale neumíme omezit, kdo co uvidí.' },
  { num: '03', text: 'Naše stará firemní prezentace vypadá jako z roku 2010 a na mobilu se nedá číst.' },
  { num: '04', text: 'Máme skvělý produkt nebo nápad, ale chybí nám moderní landing page, která by prodávala.' },
]

export function Pain() {
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const cards = sectionRef.current?.querySelectorAll<HTMLElement>('.pain-reveal')
    if (!cards) return

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.15 }
    )
    cards.forEach(card => observer.observe(card))
    return () => observer.disconnect()
  }, [])

  return (
    <section
      ref={sectionRef}
      style={{
        padding: '8rem 1.5rem',
        maxWidth: '1280px',
        margin: '0 auto',
      }}
    >
      <div className="reveal pain-reveal" style={{ marginBottom: '4rem' }}>
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
          Problém
        </span>
        <h2
          style={{
            fontFamily: '"Clash Display", system-ui, sans-serif',
            fontSize: 'clamp(2rem, 4vw, 3rem)',
            fontWeight: 600,
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
            lineHeight: 1.15,
          }}
        >
          Poznáváte se?
          <br />
          <span style={{ color: 'var(--text-secondary)', fontWeight: 400, fontSize: 'clamp(1.25rem, 3vw, 1.75rem)' }}>
            Jste na správném místě.
          </span>
        </h2>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1px',
          background: 'var(--border-subtle)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        {PAIN_POINTS.map((item, i) => (
          <div
            key={item.num}
            className={`pain-card reveal pain-reveal`}
            style={{ transitionDelay: `${i * 80}ms` }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <span
                style={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  letterSpacing: '0.1em',
                }}
              >
                {item.num}
              </span>
              <svg
                width="14" height="14" viewBox="0 0 14 14" fill="none"
                style={{ opacity: 0.35, flexShrink: 0 }}
              >
                <path d="M1 1l12 12M13 1L1 13" stroke="#F87171" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <p
              style={{
                fontSize: '1.0625rem',
                color: 'var(--text-body)',
                lineHeight: 1.65,
                fontStyle: 'italic',
              }}
            >
              „{item.text}"
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
