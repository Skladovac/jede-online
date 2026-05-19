'use client'

import { useEffect, useRef, useState } from 'react'

const FAQS = [
  {
    q: 'Musím umět programovat?',
    a: 'Ne. Celý proces vedeme my — od analýzy tabulky po nasazení aplikace. Vy jen popíšete, co váš Excel dělá.',
  },
  {
    q: 'Kolik to stojí?',
    a: 'Konzultace je zdarma. Cena finální aplikace závisí na složitosti — po konzultaci dostanete přesný odhad bez závazků.',
  },
  {
    q: 'Jak dlouho trvá vývoj?',
    a: 'Jednoduché aplikace jsou hotové za 1–2 týdny. Komplexnější projekty s více uživateli a moduly zabírají 3–6 týdnů.',
  },
  {
    q: 'Co když mám více tabulek?',
    a: 'Bez problémů. Navrhneme jednu aplikaci, která propojí všechny vaše datové zdroje do jednoho konzistentního systému.',
  },
]

export function Faq() {
  const sectionRef = useRef<HTMLElement>(null)
  const [open, setOpen] = useState<number | null>(null)

  useEffect(() => {
    const items = sectionRef.current?.querySelectorAll<HTMLElement>('.faq-reveal')
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
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>
        <div className="reveal faq-reveal" style={{ marginBottom: '4rem', textAlign: 'center' }}>
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
            FAQ
          </span>
          <h2
            style={{
              fontFamily: '"Clash Display", system-ui, sans-serif',
              fontSize: 'clamp(2rem, 4vw, 2.75rem)',
              fontWeight: 600,
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
            }}
          >
            Časté otázky.
          </h2>
        </div>

        <div>
          {FAQS.map((faq, i) => (
            <div
              key={i}
              className="faq-item reveal faq-reveal"
              style={{ transitionDelay: `${i * 60}ms` }}
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                style={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '1.5rem 0',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  gap: '1rem',
                }}
              >
                <span
                  style={{
                    fontFamily: '"Clash Display", system-ui, sans-serif',
                    fontSize: '1.0625rem',
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {faq.q}
                </span>
                <span
                  style={{
                    color: 'var(--accent-gold)',
                    fontSize: '1.25rem',
                    flexShrink: 0,
                    transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
                    transform: open === i ? 'rotate(45deg)' : 'rotate(0)',
                  }}
                >
                  +
                </span>
              </button>
              <div
                className="faq-answer"
                style={{
                  maxHeight: open === i ? '200px' : '0px',
                  opacity: open === i ? 1 : 0,
                  paddingBottom: open === i ? '1.5rem' : '0',
                }}
              >
                <p
                  style={{
                    fontSize: '0.9375rem',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.75,
                  }}
                >
                  {faq.a}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
