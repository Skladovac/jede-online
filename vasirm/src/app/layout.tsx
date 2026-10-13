import type { Metadata, Viewport } from 'next'
import { Instrument_Sans, Instrument_Serif } from 'next/font/google'
import { ALLOW_INDEXING, SITE, SITE_URL } from '@/lib/site'
import './globals.css'

const serif = Instrument_Serif({
  subsets: ['latin', 'latin-ext'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-serif',
  display: 'swap',
})
const sans = Instrument_Sans({ subsets: ['latin', 'latin-ext'], variable: '--font-sans', display: 'swap' })

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE.name} — reality Zlín a okolí`, template: `%s | ${SITE.name}` },
  description: SITE.description,
  applicationName: SITE.name,
  openGraph: { type: 'website', locale: 'cs_CZ', siteName: SITE.name },
  robots: ALLOW_INDEXING ? { index: true, follow: true } : { index: false, follow: false },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = { themeColor: '#001a3b' }

// Vše se vykresluje až na serveru: stránky čtou databázi (makléři v patičce) a env (SITE_URL, indexace),
// které při sestavení Docker image nejsou k dispozici.
export const dynamic = 'force-dynamic'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs" className={`${serif.variable} ${sans.variable}`} suppressHydrationWarning>
      <head>
        {/* Třída „js“ zapne animace nástupu; bez JS zůstane obsah rovnou vidět. */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
