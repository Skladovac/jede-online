import type { Metadata, Viewport } from 'next'
import { SiteHeader } from '@/components/SiteHeader'
import { SiteFooter } from '@/components/SiteFooter'
import { Analytics } from '@/components/Analytics'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://pokemon.jede.online'),
  title: { default: 'Pokémon karty — sbírka a výměny', template: '%s · pokemon.jede.online' },
  description: 'Evidence sbírky Pokémon karet, seznam chybějících karet a výměny mezi sběrateli v ČR a SK.',
  // Náhled odkazu na Facebooku apod.; obrázek je app/opengraph-image.tsx.
  openGraph: {
    title: 'Pokémon karty — sbírka a výměny',
    description: 'Vlastní sbírka, chybějící karty a výměny mezi sběrateli z Česka a Slovenska. Zdarma.',
    siteName: 'Pokémon karty',
    locale: 'cs_CZ',
    type: 'website',
  },
  // iPhone: po „Přidat na plochu“ se web otevře jako aplikace přes celou obrazovku.
  appleWebApp: { capable: true, title: 'Pokémon karty', statusBarStyle: 'default' },
  // Uzavřená beta: nic se zatím neindexuje.
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0f172a',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs">
      <body className="min-h-dvh bg-slate-50 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
        <div className="bg-yellow-400 px-4 py-1.5 text-center text-xs font-semibold text-slate-900">
          Zkušební provoz · nekomerční komunitní projekt ve vývoji
        </div>
        <SiteHeader />
        {children}
        <SiteFooter />
        <Analytics />
      </body>
    </html>
  )
}
