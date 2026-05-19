import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'jede.online — Váš Excel jako webová aplikace',
  description: 'Proměníme vaše tabulky v plnohodnotnou webovou aplikaci. Přesně pro váš byznys.',
  openGraph: {
    title: 'jede.online',
    description: 'Proměníme vaše tabulky v plnohodnotnou webovou aplikaci.',
    url: 'https://jede.online',
    siteName: 'jede.online',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs">
      <head>
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link
          href="https://api.fontshare.com/v2/css?f[]=clash-display@400,500,600,700&display=swap"
          rel="stylesheet"
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="grain-overlay" aria-hidden="true" />
        {children}
      </body>
    </html>
  )
}
