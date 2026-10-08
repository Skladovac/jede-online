import type { Metadata, Viewport } from 'next'
import { SiteHeader } from '@/components/SiteHeader'
import { SiteFooter } from '@/components/SiteFooter'
import { Analytics } from '@/components/Analytics'
import { getLocale } from '@/lib/i18n/server'
import { dictFor } from '@/lib/i18n/dicts'
import { I18nProvider } from '@/lib/i18n/client'
import { LOCALE_INFO, makeT } from '@/lib/i18n/config'
import './globals.css'

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
  themeColor: '#0f172a',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const dict = dictFor(locale)
  const t = makeT(dict)
  return (
    <html lang={LOCALE_INFO[locale].htmlLang}>
      <body className="min-h-dvh bg-slate-50 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
        <I18nProvider locale={locale} dict={dict}>
        <div className="bg-yellow-400 px-4 py-1.5 text-center text-xs font-semibold text-slate-900">
          {t('Zkušební provoz · komunitní projekt ve vývoji, zdarma a bez reklam')}
        </div>
        <SiteHeader />
        {children}
        <SiteFooter />
        <Analytics />
        </I18nProvider>
      </body>
    </html>
  )
}
