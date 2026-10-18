import 'server-only'
import { prisma } from '@/lib/prisma'
import { ADMIN_EMAIL, APP_URL, esc, notify } from '@/lib/email'
import { pushNotification } from '@/lib/notifications'
import { tFor } from '@/lib/i18n/server'

/**
 * Připravované sady z TCG Watchtower (robots.txt povoluje). Bereme jen název, kód, datum vydání, počet karet
 * a jméno japonské předlohy — vše ze strukturovaných dat stránky (JSON-LD), ne z rozložení stránky.
 * Ukázka karet a ceny se berou z japonské sady v našem katalogu.
 */
const SITE = 'https://tcgwatchtower.com'
const UA = 'pokemon.jede.online (+https://pokemon.jede.online; pokemon@jede.online)'
const MAX_PAGES = 12 // za jeden běh nanejvýš tolik stažených stránek (šetrnost ke zdroji)

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '')

async function get(url: string) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20_000), cache: 'no-store' })
  if (!res.ok) throw new Error(`${url} → ${res.status}`)
  return res.text()
}

type Parsed = { name: string; releaseDate: Date; code: string | null; cardCount: number | null; jaName: string | null }

/** Z JSON-LD stránky „…/cards“: název, datum vydání, kód, počet karet, japonská předloha. */
export function parseSetPage(html: string): Parsed | null {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => {
    try {
      return JSON.parse(m[1]) as Record<string, unknown>
    } catch {
      return null
    }
  })
  const graph = blocks.flatMap((b) => (b && Array.isArray(b['@graph']) ? (b['@graph'] as Record<string, unknown>[]) : b ? [b] : []))
  const page = graph.find((g) => g['@type'] === 'CollectionPage')
  if (!page) return null
  const title = String(page.name ?? '')
  const name = title.split(/ Card List| \|/)[0].trim()
  const date = new Date(String(page.datePublished ?? ''))
  if (!name || Number.isNaN(date.getTime())) return null
  const faq = JSON.stringify(graph.filter((g) => g['@type'] === 'FAQPage'))
  const text = `${String(page.description ?? '')} ${faq}`
  const code = new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\(([A-Z]{1,4}\\d{1,3}[a-z.]*)\\)`).exec(text)?.[1] ?? null
  const cardCount = Number(/(\d{2,3})[- ]card/.exec(text)?.[1]) || null
  const jaName = /Japanese ([A-Z][^"().]{2,40}?) \(/.exec(text)?.[1]?.trim() ?? null
  return { name, releaseDate: date, code, cardCount, jaName }
}

/** Noční běh: najít nové připravované sady, aktualizovat data, spárovat s katalogem, oznámit vydané. */
export async function syncUpcoming() {
  const now = new Date()
  const [enSets, jaSets, known] = await Promise.all([
    prisma.cardSet.findMany({ where: { game: 'pokemon', language: 'en' }, select: { id: true, name: true } }),
    prisma.cardSet.findMany({ where: { game: 'pokemon', language: 'ja' }, select: { id: true, name: true } }),
    prisma.upcomingSet.findMany(),
  ])
  const enByName = new Map(enSets.map((s) => [norm(s.name), s.id]))
  const jaByName = new Map(jaSets.map((s) => [norm(s.name), s.id]))
  const knownBySlug = new Map(known.map((k) => [k.slug, k]))

  // Kandidáti: stránky sad z mapy webu, které ještě nemáme v katalogu (podle názvu ze slugu), nebo známé připravované.
  const sitemap = await get(`${SITE}/sitemap.xml`)
  const slugs = [...new Set([...sitemap.matchAll(/<loc>https:\/\/tcgwatchtower\.com\/pokemon\/sets\/([a-z0-9-]+\/[a-z0-9-]+)<\/loc>/g)].map((m) => m[1]))]
  const candidates = slugs.filter((slug) => {
    const k = knownBySlug.get(slug)
    if (k) return !k.arrivedAt && k.updatedAt.getTime() < now.getTime() - 20 * 3_600_000 // znovu jednou denně
    return !enByName.has(norm(slug.split('/')[1].replace(/-/g, ' ')))
  })

  let fetched = 0
  let added = 0
  for (const slug of candidates) {
    if (fetched >= MAX_PAGES) break
    fetched++
    const url = `${SITE}/pokemon/sets/${slug}/cards`
    let parsed: Parsed | null = null
    try {
      parsed = parseSetPage(await get(url))
    } catch (err) {
      console.error('[pripravovane]', slug, err)
    }
    await new Promise((r) => setTimeout(r, 1000)) // šetrně: 1 stránka za sekundu
    if (!parsed) continue
    const jaSetId = parsed.jaName ? (jaByName.get(norm(parsed.jaName)) ?? null) : null
    const data = { name: parsed.name, code: parsed.code, releaseDate: parsed.releaseDate, cardCount: parsed.cardCount, jaName: parsed.jaName, jaSetId, sourceUrl: url.replace(/\/cards$/, '') }
    // Dávno vydaná sada, kterou jen jinak pojmenováváme: zapamatovat jako „vyřízenou“, ať ji příště znovu nestahujeme.
    const old = !knownBySlug.has(slug) && parsed.releaseDate.getTime() < now.getTime() - 14 * 86_400_000
    await prisma.upcomingSet.upsert({ where: { slug }, create: { slug, ...data, ...(old && { arrivedAt: now }) }, update: data })
    if (old) continue
    if (!knownBySlug.has(slug)) added++
  }

  // Vydané: anglická sada už je v katalogu → označit a poslat upozornění zájemcům.
  const pending = await prisma.upcomingSet.findMany({ where: { arrivedAt: null }, include: { subs: { include: { user: { select: { id: true, email: true, locale: true, nickname: true, isMinor: true, parentEmail: true } } } } } })
  let arrived = 0
  for (const u of pending) {
    const setId = enByName.get(norm(u.name))
    if (!setId) continue
    await prisma.upcomingSet.update({ where: { id: u.id }, data: { arrivedAt: now, arrivedSetId: setId } })
    arrived++
    for (const s of u.subs) {
      const tt = tFor(s.user.locale)
      const url = `/sady/${encodeURIComponent(setId)}`
      await pushNotification(s.user.id, { icon: '✨', title: tt('{name} je na webu!', { name: u.name }), body: tt('Odklikej si, co máš a co ti chybí.'), url })
      await notify(
        s.user.email,
        s.user.isMinor && s.user.parentEmail ? [s.user.parentEmail] : [],
        tt('{name} je na webu!', { name: u.name }),
        [tt('Ahoj {name}, sada {set}, na kterou jsi čekal(a), je v katalogu.', { name: esc(s.user.nickname), set: esc(u.name) }), tt('Odklikej si, co máš a co ti chybí.')],
        { label: tt('Otevřít sadu'), url: `${APP_URL}${url}` },
        s.user.locale,
      ).catch((err) => console.error('[pripravovane]', err))
    }
  }
  return { candidates: candidates.length, fetched, added, arrived }
}

/** Cron: běh s ohlášením chyby adminovi (aby nefunkční zdroj nezůstal bez povšimnutí). */
export async function runUpcomingSync() {
  try {
    return await syncUpcoming()
  } catch (err) {
    console.error('[pripravovane]', err)
    await notify(ADMIN_EMAIL, [], 'Připravované sady: stahování selhalo', [esc(String(err)).slice(0, 500), 'Zdroj: tcgwatchtower.com — možná změnili web.']).catch(() => {})
    return { error: String(err).slice(0, 200) }
  }
}

/** Připravované sady k zobrazení: nevydané (nebo vydané, ale ještě nedorazily do katalogu), od nejbližší. */
export async function upcomingSets(userId?: string | null) {
  return prisma.upcomingSet.findMany({
    where: { arrivedAt: null, releaseDate: { gt: new Date(Date.now() - 21 * 86_400_000) } },
    orderBy: { releaseDate: 'asc' },
    include: { subs: userId ? { where: { userId }, select: { userId: true } } : false, _count: { select: { subs: true } } },
    take: 6,
  })
}

/** Za kolik dní (pražský kalendář). */
export function daysUntil(date: Date, now = new Date()) {
  const day = (d: Date) => Date.parse(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague' }).format(d))
  return Math.round((day(date) - day(now)) / 86_400_000)
}
