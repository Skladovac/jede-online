import type { Metadata, Viewport } from 'next'
import { SiteHeader } from '@/components/SiteHeader'
import { SiteFooter } from '@/components/SiteFooter'
import { InstallPrompt } from '@/components/InstallApp'
import { Analytics } from '@/components/Analytics'
import { getLocale } from '@/lib/i18n/server'
import { dictFor } from '@/lib/i18n/dicts'
import { I18nProvider } from '@/lib/i18n/client'
import { LOCALE_INFO, makeT } from '@/lib/i18n/config'
import { cookies } from 'next/headers'
import { Bricolage_Grotesque, Figtree, JetBrains_Mono } from 'next/font/google'
import './globals.css'

// Písma „Sběratelské galerie“: nadpisy Bricolage Grotesque, text Figtree, čísla karet a ceny JetBrains Mono.
const display = Bricolage_Grotesque({ subsets: ['latin', 'latin-ext'], variable: '--font-display', display: 'swap' })
const sans = Figtree({ subsets: ['latin', 'latin-ext'], variable: '--font-sans', display: 'swap' })
const mono = JetBrains_Mono({ subsets: ['latin', 'latin-ext'], weight: ['500', '700'], variable: '--font-mono', display: 'swap' })

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const t = makeT(dictFor(locale))
  return {
  metadataBase: new URL('https://pokemon.jede.online'),
  title: { default: t('Pokémon karty — sbírka a výměny'), template: '%s · pokemon.jede.online' },
  description: t('Evidence sbírky Pokémon karet, seznam chybějících karet a výměny mezi sběrateli v ČR a SK.'),
  // Náhled odkazu na Facebooku apod.; obrázek je app/opengraph-image.tsx.
  openGraph: {
    title: t('Pokémon karty — sbírka a výměny'),
    description: t('Vlastní sbírka, chybějící karty a výměny mezi sběrateli z Česka a Slovenska. Zdarma.'),
    siteName: t('Pokémon karty'),
    locale: LOCALE_INFO[locale].intl.replace('-', '_'),
    type: 'website',
  },
  // iPhone: po „Přidat na plochu“ se web otevře jako aplikace přes celou obrazovku.
  appleWebApp: { capable: true, title: t('Pokémon karty'), statusBarStyle: 'default' },
  // Web je otevřený vyhledávačům (soukromé stránky mají vlastní noindex nebo vyžadují přihlášení).
  robots: { index: true, follow: true },
  // Ověření v Google Search Console.
  verification: { google: 'WbDOgMWEk6Xsoxhiz84m52ST6trhTHuVElDuAs9lavI' },
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ffcb05', // barva lišty prohlížeče = žlutá hlavička
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const dict = dictFor(locale)
  const theme = (await cookies()).get('theme')?.value
  return (
    // Vzhled: výchozí světlý (Pokémon modrá + žlutá), tmavý jen když si ho uživatel přepnul (cookie „theme“ z ThemeToggle).
    <html lang={LOCALE_INFO[locale].htmlLang} className={`${display.variable} ${sans.variable} ${mono.variable}${theme === 'dark' ? ' dark' : ''}`}>
      <body className="min-h-dvh bg-base pb-[calc(3.5rem+env(safe-area-inset-bottom))] text-fg antialiased sm:pb-0">
        <I18nProvider locale={locale} dict={dict}>
        <SiteHeader />
        {children}
        <SiteFooter />
        <InstallPrompt />
        <Analytics />
        </I18nProvider>
      </body>
    </html>
  )
}
