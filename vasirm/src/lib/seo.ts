import 'server-only'
import { SITE, SITE_URL } from '@/lib/site'
import type { Agent } from '@/lib/agents'

const abs = (p: string) => (p.startsWith('http') ? p : `${SITE_URL}${p}`)

/** Realitní kancelář + oba makléři (JSON-LD na každé stránce). */
export function organizationLd(agents: Agent[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'RealEstateAgent',
    '@id': `${SITE_URL}/#vrm`,
    name: SITE.name,
    alternateName: SITE.short,
    description: SITE.description,
    url: SITE_URL,
    logo: abs('/img/logo.png'),
    image: abs('/img/team/par-1600.webp'),
    telephone: SITE.phone,
    email: SITE.email,
    address: { '@type': 'PostalAddress', addressLocality: 'Zlín', addressRegion: 'Zlínský kraj', addressCountry: 'CZ' },
    areaServed: SITE.areaServed.map((name) => ({ '@type': 'City', name })),
    employee: agents.map((a) => ({
      '@type': 'Person',
      '@id': `${SITE_URL}/makleri/${a.slug}#person`,
      url: `${SITE_URL}/makleri/${a.slug}`,
      name: a.name,
      jobTitle: a.role,
      telephone: a.phone || undefined,
      email: a.publicEmail || undefined,
      image: a.photo ? abs(a.photo) : undefined,
    })),
  }
}

export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: abs(it.path) })),
  }
}

export { abs }
