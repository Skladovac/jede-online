import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'bg-base': '#050508',
        'bg-elevated': '#0B0B12',
        'bg-overlay': '#14141C',
        gold: {
          DEFAULT: '#C9A961',
          hover: '#D4AF37',
          pressed: '#B8954E',
        },
      },
      fontFamily: {
        display: ['"Clash Display"', '"Space Grotesk"', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      maxWidth: {
        content: '1280px',
      },
      screens: {
        xs: '480px',
      },
    },
  },
  plugins: [],
}

export default config
