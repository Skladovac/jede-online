'use client'

import { useEffect, useRef, useState } from 'react'

export function CtaSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const items = sectionRef.current?.querySelectorAll<HTMLElement>('.cta-reveal')
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
      { threshold: 0.2 }
    )
    items.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.includes('@')) { setError('Zadejte platnou e-mailovou adresu.'); return }
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'cta' }),
      })
      if (res.ok) {
        setSubmitted(true)
      } else {
        const data = await res.json()
        setError(data.error ?? 'Něco se pokazilo.')
      }
    } catch {
      setError('Nepodařilo se připojit.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section
      id="cta"
      ref={sectionRef}
      style={{
        padding: '8rem 1.5rem',
        textAlign: 'center',
        background: 'var(--bg-base)',
      }}
    >
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        <div className="reveal cta-reveal" style={{ marginBottom: '1rem' }}>
          <span
            style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '0.75rem',
              color: 'var(--accent-gold)',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
          >
            Začít
          </span>
        </div>

        <h2
          className="reveal cta-reveal"
          style={{
            fontFamily: '"Clash Display", system-ui, sans-serif',
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            fontWeight: 600,
            color: 'var(--text-primary)',
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
            marginBottom: '1.5rem',
          }}
        >
          Stačí jeden email.
        </h2>

        <p
          className="reveal cta-reveal"
          style={{
            fontSize: '1rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.7,
            marginBottom: '2.5rem',
          }}
        >
          Bez závazků. Bezplatná konzultace do 48 hodin.
        </p>

        {submitted ? (
          <div
            className="reveal cta-reveal"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}
          >
            <div
              style={{
                width: '2.5rem',
                height: '2.5rem',
                borderRadius: '50%',
                border: '1px solid var(--accent-gold)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-gold)',
              }}
            >
              ✓
            </div>
            <p
              style={{
                fontFamily: '"Clash Display", system-ui, sans-serif',
                fontSize: '1.125rem',
                color: 'var(--text-primary)',
              }}
            >
              Ozveme se do 48 hodin.
            </p>
          </div>
        ) : (
          <form
            className="reveal cta-reveal"
            onSubmit={handleSubmit}
            style={{
              display: 'flex',
              gap: '0.75rem',
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="váš@email.cz"
              required
              className="input-underline"
              style={{ flex: '1 1 240px', maxWidth: '320px' }}
            />
            <button type="submit" disabled={loading} className="btn-gold">
              {loading ? 'Odesílám…' : 'Chci svoji aplikaci →'}
            </button>
          </form>
        )}

        {error && (
          <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#F87171' }}>{error}</p>
        )}
      </div>
    </section>
  )
}
