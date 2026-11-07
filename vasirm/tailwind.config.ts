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
      letterSpacing: { label: '0.18em' },
      maxWidth: { site: '84rem' },
      transitionTimingFunction: { out: 'cubic-bezier(.22,1,.36,1)' },
    },
  },
  plugins: [],
}

export default config
