// Rejstřík map webu (sitemap index) — jedna adresa pro Google Search Console i robots.txt.
// (/sitemap.xml si bere Next pro app/sitemap.ts, proto vlastní název.)
// Jednotlivé mapy generuje app/sitemap.ts (/sitemap/0.xml = stránky, sady, produkty, aukce, profily; 1–3 = karty).
const BASE = 'https://pokemon.jede.online'

export const dynamic = 'force-dynamic'

export function GET() {
  const now = new Date().toISOString()
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[0, 1, 2, 3].map((i) => `  <sitemap><loc>${BASE}/sitemap/${i}.xml</loc><lastmod>${now}</lastmod></sitemap>`).join('\n')}
</sitemapindex>
`
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } })
}
