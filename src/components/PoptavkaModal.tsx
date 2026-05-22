'use client'

import { useEffect, useRef, useState } from 'react'

interface Form {
  jmeno: string; prijmeni: string; firma: string; web: string
  email: string; telefon: string; zprava: string
}
const INIT: Form = { jmeno: '', prijmeni: '', firma: '', web: '', email: '', telefon: '', zprava: '' }

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: '"JetBrains Mono", monospace',
  fontSize: '0.6875rem',
  color: 'var(--text-muted)',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  marginBottom: '0.5rem',
}

function Field({
  label, type = 'text', value, onChange, required, placeholder,
}: {
  label: string; type?: string; value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  required?: boolean; placeholder?: string
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
        className="modal-field"
      />
    </div>
  )
}

export function PoptavkaModal() {
  const [open, setOpen]       = useState(false)
  const [form, setForm]       = useState<Form>(INIT)
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState('')
  const firstRef              = useRef<HTMLInputElement>(null)

  /* ── Otwieranie przez CustomEvent ── */
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ prefill?: string }>
      setOpen(true)
      setSent(false)
      setError('')
      setForm(prev => ({ ...INIT, zprava: ce.detail?.prefill ?? '' }))
    }
    window.addEventListener('open-modal', handler)
    return () => window.removeEventListener('open-modal', handler)
  }, [])

  /* ── Focus prvního pole ── */
  useEffect(() => {
    if (open) setTimeout(() => firstRef.current?.focus(), 60)
  }, [open])

  /* ── Escape ── */
  useEffect(() => {
    if (!open) return
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [open])

  /* ── Scroll lock ── */
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const close = () => {
    setOpen(false)
    setTimeout(() => { setForm(INIT); setSent(false); setError('') }, 350)
  }

  const set = (k: keyof Form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/poptavka', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) { setSent(true) }
      else { const d = await res.json(); setError(d.error ?? 'Něco se pokazilo.') }
    } catch { setError('Nepodařilo se připojit. Zkuste to znovu.') }
    finally { setLoading(false) }
  }

  if (!open) return null

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) close() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
        backdropFilter: 'blur(8px) brightness(0.4)',
        WebkitBackdropFilter: 'blur(8px) brightness(0.4)',
        animation: 'mFadeIn 0.22s ease both',
      }}
    >
      {/* Panel */}
      <div
        role="dialog" aria-modal="true"
        style={{
          position: 'relative',
          width: '100%', maxWidth: '600px',
          maxHeight: '90vh', overflowY: 'auto',
          background: 'rgba(6,7,12,0.97)',
          border: '1px solid rgba(201,169,97,0.16)',
          borderRadius: '18px',
          padding: 'clamp(1.75rem, 4vw, 3rem)',
          boxShadow: '0 40px 100px rgba(0,0,0,0.75), 0 0 0 1px rgba(201,169,97,0.05)',
          animation: 'mSlideUp 0.32s cubic-bezier(0.4,0,0.2,1) both',
        }}
      >
        {/* Zavřít */}
        <button
          onClick={close} aria-label="Zavřít"
          style={{
            position: 'absolute', top: '1.25rem', right: '1.25rem',
            background: 'none', border: 'none',
            color: 'rgba(255,255,255,0.3)', fontSize: '1.75rem', lineHeight: 1,
            cursor: 'pointer', padding: '0.25rem 0.5rem',
            transition: 'color 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.75)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
        >
          ×
        </button>

        {/* Záhlaví */}
        <div style={{ marginBottom: '2rem' }}>
          <span style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '0.6875rem', color: 'var(--accent-gold)',
            letterSpacing: '0.12em', textTransform: 'uppercase',
            display: 'block', marginBottom: '1rem',
          }}>
            Nezávazná poptávka
          </span>
          <h2 style={{
            fontFamily: '"Clash Display", system-ui, sans-serif',
            fontSize: 'clamp(1.5rem, 3vw, 2rem)',
            fontWeight: 600, color: 'var(--text-primary)',
            letterSpacing: '-0.02em', lineHeight: 1.15,
            marginBottom: '0.875rem',
          }}>
            Pojďme to probrat.
          </h2>
          <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)', lineHeight: 1.72 }}>
            Nechte nám na sebe kontakt. Ozveme se vám zpět do 24 hodin a společně vymyslíme nejlepší řešení pro váš byznys. Neformálně a bez závazků.
          </p>
        </div>

        {sent ? (
          /* Úspěch */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '2rem 0', textAlign: 'center' }}>
            <div style={{
              width: '3.25rem', height: '3.25rem', borderRadius: '50%',
              border: '1px solid var(--accent-gold)',
              boxShadow: '0 0 24px rgba(201,169,97,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--accent-gold)', fontSize: '1.25rem',
            }}>✓</div>
            <h3 style={{
              fontFamily: '"Clash Display", system-ui, sans-serif',
              fontSize: '1.5rem', fontWeight: 600,
              color: 'var(--text-primary)', letterSpacing: '-0.01em',
            }}>
              Poptávka odeslána.
            </h3>
            <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)', lineHeight: 1.65 }}>
              Ozveme se vám zpět do 24 hodin.
            </p>
          </div>
        ) : (
          /* Formulář */
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              <div>
                <label style={labelStyle}>Jméno *</label>
                <input ref={firstRef} type="text" value={form.jmeno} onChange={set('jmeno')} required placeholder="Jan" className="modal-field" />
              </div>
              <div>
                <label style={labelStyle}>Příjmení *</label>
                <input type="text" value={form.prijmeni} onChange={set('prijmeni')} required placeholder="Novák" className="modal-field" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              <div>
                <label style={labelStyle}>Název firmy</label>
                <input type="text" value={form.firma} onChange={set('firma')} placeholder="Vaše firma s.r.o." className="modal-field" />
              </div>
              <div>
                <label style={labelStyle}>Současný web</label>
                <input type="text" value={form.web} onChange={set('web')} placeholder="www.vasweb.cz" className="modal-field" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              <div>
                <label style={labelStyle}>E-mail *</label>
                <input type="email" value={form.email} onChange={set('email')} required placeholder="jan@firma.cz" className="modal-field" />
              </div>
              <div>
                <label style={labelStyle}>Telefon *</label>
                <input type="tel" value={form.telefon} onChange={set('telefon')} required placeholder="+420 123 456 789" className="modal-field" />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Vaše zpráva *</label>
              <textarea
                value={form.zprava} onChange={set('zprava')} required rows={4}
                placeholder="Krátce popište, co řešíte nebo co potřebujete..."
                className="modal-field"
                style={{ resize: 'vertical', minHeight: '96px' }}
              />
            </div>

            {error && (
              <p style={{ fontSize: '0.875rem', color: '#F87171', margin: '-0.25rem 0' }}>{error}</p>
            )}

            <button
              type="submit" disabled={loading}
              className="btn-gold"
              style={{ width: '100%', fontSize: '0.9375rem', padding: '1rem 1.5rem', marginTop: '0.25rem' }}
            >
              {loading ? 'Odesílám…' : 'Odeslat nezávaznou poptávku →'}
            </button>
          </form>
        )}
      </div>

      <style>{`
        @keyframes mFadeIn  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes mSlideUp { from { opacity: 0; transform: translateY(28px) } to { opacity: 1; transform: translateY(0) } }
        .modal-field {
          background: transparent; border: none; outline: none; width: 100%;
          border-bottom: 1px solid var(--border-default);
          color: var(--text-primary);
          font-size: 0.9375rem; font-family: Inter, system-ui, sans-serif;
          padding: 0.625rem 0;
          transition: border-color 0.25s;
          display: block;
        }
        .modal-field:focus { border-bottom-color: var(--accent-gold); }
        .modal-field::placeholder { color: var(--text-muted); }
        textarea.modal-field { font-family: Inter, system-ui, sans-serif; }
      `}</style>
    </div>
  )
}
