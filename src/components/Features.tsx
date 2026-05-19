'use client'

import { useEffect, useRef } from 'react'

const FEATURES = [
  {
    title: 'Přístup odkudkoliv',
    desc: 'Web app běží v prohlížeči — žádná instalace, plně funkční na mobilu i PC.',
  },
  {
    title: 'Role a oprávnění',
    desc: 'Každý vidí jen to, co má. Oddělte data pro tým, management i klienty.',
  },
  {
    title: 'Váš branding',
    desc: 'Vlastní doména, logo a barevné téma. Aplikace vypadá jako váš produkt.',
  },
  {
    title: 'Data v reálném čase',
    desc: 'Všichni pracují se stejnými daty. Žádné verze, žádné konflikty.',
  },
]

export function Features() {
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const items = sectionRef.current?.querySelectorAll<HTMLElement>('.feat-reveal')
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
        maxWidth: '1280px',
        margin: '0 auto',
      }}
    >
      <div className="reveal feat-reveal" style={{ marginBottom: '4rem' }}>
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
          Co dostanete
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
          Aplikace postavená
          <br />
          přesně pro vás.
        </h2>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '1rem',
        }}
      >
        {FEATURES.map((feat, i) => (
          <div
            key={feat.title}
            className={`feature-card reveal feat-reveal`}
            style={{ transitionDelay: `${i * 80}ms` }}
          >
            <h3
              style={{
                fontFamily: '"Clash Display", system-ui, sans-serif',
                fontSize: '1.125rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                letterSpacing: '-0.01em',
                marginBottom: '0.75rem',
              }}
            >
              {feat.title}
            </h3>
            <p
              style={{
                fontSize: '0.9375rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.7,
              }}
            >
              {feat.desc}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
