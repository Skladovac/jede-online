/** Strukturovaná data pro vyhledávače (schema.org JSON-LD). `<` se escapuje, aby text nemohl ukončit <script>. */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />
}

export const SITE = 'https://pokemon.jede.online'

/** Drobečková navigace pro Google (BreadcrumbList). */
export const breadcrumbs = (items: { name: string; url: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: it.url.startsWith('http') ? it.url : `${SITE}${it.url}` })),
})
