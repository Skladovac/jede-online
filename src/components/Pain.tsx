'use client'

import { useEffect, useRef } from 'react'

const PAIN_POINTS = [
  { num: '01', text: 'Pět verzí souboru a každý pracuje s tou svojí.' },
  { num: '02', text: 'Na mobilu nebo u klienta se to nedá otevřít.' },
  { num: '03', text: 'Klient vidí data, která by vidět neměl.' },
  { num: '04', text: 'Jeden přepis ve špatném řádku — hodiny opravování.' },
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
            <span
              style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                letterSpacing: '0.1em',
                display: 'block',
                marginBottom: '1.25rem',
              }}
            >
              {item.num}
            </span>
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
