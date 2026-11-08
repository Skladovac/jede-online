import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Barvy převzaté ze stávajícího webu vasirm.cz: tmavě modrá #001a3b, písková zlatá #c5a880, bílá a #f9f9f9.
        ink: { DEFAULT: '#001a3b', 2: '#06224a', 3: '#0f2d58', 4: '#1a3966' },
        paper: { DEFAULT: '#ffffff', 2: '#f9f9f9', 3: '#eef1f4' },
        // deep = zlatá ztmavená pro malý text na bílé (kontrast 4,9 : 1)
        gold: { DEFAULT: '#c5a880', light: '#dcc6a3', deep: '#8b6b3d' },
        stone: { DEFAULT: '#5c6575', light: '#9aa1ad' },
      },
      fontFamily: {
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      // Logo v hlavičce (verzálky jako v logu). Popisky sekcí jsou normálním písmem.
      letterSpacing: { label: '0.18em' },
      fontSize: {
        label: ['0.8125rem', { lineHeight: '1.25rem' }], // 13 px — popisky sekcí, meta
        ui: ['0.9375rem', { lineHeight: '1.375rem' }], // 15 px — tlačítka, menu, kontakty
      },
      maxWidth: { site: '84rem' },
      // Jedna křivka a krátké časy pro všechny přechody.
      transitionTimingFunction: { DEFAULT: 'cubic-bezier(.22,1,.36,1)', out: 'cubic-bezier(.22,1,.36,1)' },
      transitionDuration: { DEFAULT: '150ms' },
    },
  },
  plugins: [],
}

export default config
