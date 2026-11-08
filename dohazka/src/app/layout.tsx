import type { Metadata, Viewport } from 'next'
import { cookies } from 'next/headers'
import { Inter } from 'next/font/google'
import { Footer } from '@/components/Footer'
import { RegisterSw } from '@/components/RegisterSw'
import './globals.css'

const sans = Inter({ subsets: ['latin', 'latin-ext'], variable: '--font-sans', display: 'swap' })

export const metadata: Metadata = {
  metadataBase: new URL('https://dohazka.jede.online'),
  title: { default: 'Docházka — evidence hodin', template: '%s · Docházka' },
  description: 'Zapisujte odpracované hodiny a místo práce, na konci měsíce si vyexportujte výkaz pro zaměstnavatele.',
  // Soukromá evidence, vyhledávačům nic nenabízíme.
  robots: { index: false, follow: false },
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Docházka' },
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1 }

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = (await cookies()).get('theme')?.value
  return (
    // Výchozí světlý vzhled, tmavý jen když je nastavená cookie „theme=dark“ (zatím ji nic v aplikaci nenastavuje, přepínač neexistuje).
    <html lang="cs" className={`${sans.variable}${theme === 'dark' ? ' dark' : ''}`}>
      <body className="flex min-h-dvh flex-col bg-base text-fg antialiased">
        <div className="flex-1">{children}</div>
        <Footer />
        <RegisterSw />
      </body>
    </html>
  )
}
