import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  // Tmavý vzhled podle třídy na <html> (výchozí světlý, přepínač v hlavičce), ne podle systému.
  darkMode: 'class',
  theme: {
    extend: {
      // Barvy z design tokenů v globals.css (mění se se světlým/tmavým vzhledem).
      colors: {
        base: 'var(--bg-primary)',
        surface: 'var(--bg-secondary)',
        card: 'var(--bg-card)',
        'card-hover': 'var(--bg-card-hover)',
        line: 'var(--border)',
        'line-strong': 'var(--border-strong)',
        fg: 'var(--text-primary)',
        muted: 'var(--text-secondary)',
        subtle: 'var(--text-muted)',
        accent: 'var(--accent)',
        'accent-strong': 'var(--accent-strong)',
        'accent-hover': 'var(--accent-hover)',
        'accent-soft': 'var(--accent-soft)',
        'on-accent': 'var(--on-accent)',
        positive: 'var(--positive)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
        'line-hover': 'var(--border-hover)',
        // Značkové barvy (header, footer, odznaky, Pokéball motivy)
        'brand-blue': 'var(--pokemon-blue)',
        'brand-blue-dark': 'var(--pokemon-blue-dark)',
        'brand-blue-deep': 'var(--pokemon-blue-deep)',
        'brand-yellow': 'var(--pokemon-yellow)',
        'brand-yellow-dark': 'var(--pokemon-yellow-dark)',
        'brand-red': 'var(--pokemon-red)',
      },
      borderRadius: { panel: '14px' },
      boxShadow: { soft: 'var(--shadow-soft)' },
      maxWidth: { page: '1280px' },
    },
  },
  plugins: [],
}

export default config
