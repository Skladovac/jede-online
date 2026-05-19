'use client'

import { useEffect, useRef } from 'react'

const STEPS = [
  {
    num: '01',
    title: 'Popište nám váš Excel',
    desc: 'Ukažte nám, co tabulka dělá, kdo s ní pracuje a jaká data spravuje.',
  },
  {
    num: '02',
    title: 'Navrhneme architekturu',
    desc: 'Během konzultace zmapujeme datový model, workflow a uživatelské role.',
  },
  {
    num: '03',
    title: 'Spustíme vaši aplikaci',
    desc: 'Plně funkční web app, nasazená na vaší doméně a připravená pro tým.',
  },
]

export function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const items = sectionRef.current?.querySelectorAll<HTMLElement>('.how-reveal')
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
        <div className="reveal how-reveal" style={{ marginBottom: '5rem', textAlign: 'center' }}>
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
            Jak to funguje
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
            Tři kroky od tabulky
            <br />
            k vlastní aplikaci.
          </h2>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '2rem',
          }}
        >
          {STEPS.map((step, i) => (
            <div
              key={step.num}
              className="reveal how-reveal"
              style={{ transitionDelay: `${i * 100}ms` }}
            >
              {/* Number */}
              <div
                style={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: '3.5rem',
                  fontWeight: 500,
                  color: 'var(--accent-gold)',
                  opacity: 0.25,
                  lineHeight: 1,
                  marginBottom: '1.5rem',
                  letterSpacing: '-0.02em',
                }}
              >
                {step.num}
              </div>

              {/* Gold line */}
              <div
                style={{
                  width: '2rem',
                  height: '1px',
                  background: 'var(--accent-gold)',
                  opacity: 0.5,
                  marginBottom: '1.5rem',
                }}
              />

              <h3
                style={{
                  fontFamily: '"Clash Display", system-ui, sans-serif',
                  fontSize: '1.25rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.01em',
                  marginBottom: '0.75rem',
                }}
              >
                {step.title}
              </h3>
              <p
                style={{
                  fontSize: '0.9375rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.7,
                }}
              >
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
