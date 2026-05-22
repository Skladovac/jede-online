'use client'

import { useEffect, useRef, useState } from 'react'
import { openModal } from '@/lib/openModal'

export function CtaSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    const items = sectionRef.current?.querySelectorAll<HTMLElement>('.cta-reveal')
    if (!items) return
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in-view'); observer.unobserve(e.target) } }),
      { threshold: 0.2 }
    )
    items.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <section
      id="cta"
      ref={sectionRef}
      style={{ padding: '8rem 1.5rem', textAlign: 'center', background: 'var(--bg-base)' }}
    >
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        <div className="reveal cta-reveal" style={{ marginBottom: '1rem' }}>
          <span style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '0.75rem', color: 'var(--accent-gold)',
            letterSpacing: '0.12em', textTransform: 'uppercase',
          }}>
            Začít
          </span>
        </div>

        <h2
          className="reveal cta-reveal"
          style={{
            fontFamily: '"Clash Display", system-ui, sans-serif',
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            fontWeight: 600, color: 'var(--text-primary)',
            letterSpacing: '-0.03em', lineHeight: 1.1,
            marginBottom: '1.5rem',
          }}
        >
          Stačí jeden krok.
        </h2>

        <p
          className="reveal cta-reveal"
          style={{
            fontSize: '1rem', color: 'var(--text-secondary)',
            lineHeight: 1.7, marginBottom: '2.75rem',
          }}
        >
          Nechte unavené tabulky i staré weby minulosti. Klikněte a pojďme postavit řešení, které opravdu jede.
        </p>

        <div className="reveal cta-reveal">
          <button
            className="btn-gold"
            onClick={() => openModal()}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
              fontSize: '1rem',
              padding: '1rem 2.5rem',
              transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
              boxShadow: hovered
                ? '0 0 0 1px rgba(201,169,97,0.3), 0 0 24px rgba(201,169,97,0.5), 0 0 60px rgba(201,169,97,0.2)'
                : '0 0 0 1px rgba(201,169,97,0.15), 0 0 16px rgba(201,169,97,0.25)',
              transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1), box-shadow 0.35s cubic-bezier(0.4,0,0.2,1)',
            }}
          >
            Spojit se s námi a začít →
          </button>
        </div>
      </div>
    </section>
  )
}
