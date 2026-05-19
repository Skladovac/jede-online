'use client'

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer
      style={{
        padding: '3rem 1.5rem',
        borderTop: '1px solid var(--border-subtle)',
        background: 'var(--bg-base)',
      }}
    >
      <div
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <span
          style={{
            fontFamily: '"Clash Display", system-ui, sans-serif',
            fontSize: '1rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
          }}
        >
          jede<span style={{ color: 'var(--accent-gold)' }}>.</span>online
        </span>

        <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
          <a
            href="/podminky"
            style={{
              fontSize: '0.8125rem',
              color: 'var(--text-muted)',
              textDecoration: 'none',
              transition: 'color 0.2s',
            }}
            onMouseEnter={e => ((e.target as HTMLElement).style.color = 'var(--text-secondary)')}
            onMouseLeave={e => ((e.target as HTMLElement).style.color = 'var(--text-muted)')}
          >
            Podmínky
          </a>
          <a
            href="mailto:info@jede.online"
            style={{
              fontSize: '0.8125rem',
              color: 'var(--text-muted)',
              textDecoration: 'none',
              transition: 'color 0.2s',
            }}
            onMouseEnter={e => ((e.target as HTMLElement).style.color = 'var(--accent-gold)')}
            onMouseLeave={e => ((e.target as HTMLElement).style.color = 'var(--text-muted)')}
          >
            info@jede.online
          </a>
        </div>

        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          © {year} jede.online
        </p>
      </div>
    </footer>
  )
}
