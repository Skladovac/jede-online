'use client'

import { useEffect, useRef } from 'react'

const SEGMENTS = [
  'Freelanceři a OSVČ',
  'Účetní a finanční poradci',
  'Realitní kanceláře',
  'Výrobní a obchodní firmy',
  'Půjčovny a sklady',
  'Malé týmy bez IT oddělení',
]

export function ForWhom() {
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const items = sectionRef.current?.querySelectorAll<HTMLElement>('.fw-reveal')
    if (!items) return

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view')
            observer.unobserve(entry.target)
          }
        })
      },
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
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '4rem',
            alignItems: 'center',
          }}
        >
          {/* Left */}
          <div className="reveal fw-reveal">
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
              Pro koho
            </span>
            <h2
              style={{
                fontFamily: '"Clash Display", system-ui, sans-serif',
                fontSize: 'clamp(2rem, 4vw, 3rem)',
                fontWeight: 600,
                color: 'var(--text-primary)',
                letterSpacing: '-0.02em',
                lineHeight: 1.15,
                marginBottom: '1.5rem',
              }}
            >
              Každý, kdo řídí
              <br />
              byznys v Excelu.
            </h2>
            <p
              style={{
                fontSize: '1rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.75,
              }}
            >
              Nemusíte rozumět programování. Stačí vědět, co vaše tabulka dělá — zbytek je na nás.
            </p>
          </div>

          {/* Right: segment list */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0',
            }}
          >
            {SEGMENTS.map((seg, i) => (
              <div
                key={seg}
                className="reveal fw-reveal"
                style={{
                  transitionDelay: `${i * 60}ms`,
                  padding: '1.125rem 0',
                  borderBottom: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                }}
              >
                <span
                  style={{
                    width: '4px',
                    height: '4px',
                    borderRadius: '50%',
                    background: 'var(--accent-gold)',
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontFamily: '"Clash Display", system-ui, sans-serif',
                    fontSize: '1rem',
                    fontWeight: 500,
                    color: 'var(--text-body)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {seg}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
