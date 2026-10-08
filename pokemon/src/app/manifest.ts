import type { MetadataRoute } from 'next'

// Instalace webu na plochu telefonu (PWA): ikona, celá obrazovka, barvy.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Pokémon karty – sbírka a výměny',
    short_name: 'Pokémon karty',
    description: 'Vlastní sbírka, chybějící karty a výměny mezi sběrateli z Česka a Slovenska.',
    lang: 'cs',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0f172a',
    theme_color: '#0f172a',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Moje sbírka', url: '/sbirka' },
      { name: 'Najdi sběratele', url: '/sberatele' },
      { name: 'Výměny', url: '/poptavky' },
    ],
  }
}
