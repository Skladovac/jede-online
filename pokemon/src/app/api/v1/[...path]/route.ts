import { NextResponse, type NextRequest } from 'next/server'
import { tokenFromRequest, userFromToken } from '@/lib/api-auth'
import { aiAuctions, aiCard, aiCollection, aiMissing, aiOverview, aiRequests, aiSearch, aiSets } from '@/lib/ai-data'
import { aiAddCards, aiClearOffer, aiMarkMissing, aiSetOffer, aiSetQuantity, aiUnmarkMissing, WriteFail } from '@/lib/ai-write'

export const dynamic = 'force-dynamic'

/**
 * REST pro AI asistenty a „vlastní GPT“. Klíč jen v hlavičce Authorization: Bearer pk_….
 *   GET  /api/v1/me · /collection?set=sv01 · /missing?set=sv01&all=1 · /sets · /sets/{id} · /cards/{id} · /search?q=… · /trades · /auctions
 *   POST /api/v1/add · /quantity · /missing · /missing/remove · /offer · /offer/clear (JSON tělo, viz openapi.json)
 * Popis pro nástroje: GET /api/v1/openapi.json (bez klíče).
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params
  const [a, b] = path
  if (a === 'openapi.json') return NextResponse.json(openapi(), { headers: { 'Cache-Control': 'public, max-age=3600' } })

  // Klíč jen v hlavičce (v adrese by zůstal v logách a historii prohlížeče).
  const user = await userFromToken(tokenFromRequest(req, null))
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if ('error' in user) return NextResponse.json({ error: user.error }, { status: user.status })
  const q = req.nextUrl.searchParams

  try {
    switch (a) {
      case 'me':
        return NextResponse.json(await aiOverview(user.id, user.nickname))
      case 'collection':
        return NextResponse.json(await aiCollection(user.id, q.get('set'), Number(q.get('limit')) || 500))
      case 'missing':
        return NextResponse.json(await aiMissing(user.id, q.get('set'), q.get('all') === '1'))
      case 'sets': {
        const r = await aiSets(user.id, b ?? null)
        return r ? NextResponse.json(r) : NextResponse.json({ error: 'not found' }, { status: 404 })
      }
      case 'cards': {
        const r = b ? await aiCard(b, user.id) : null
        return r ? NextResponse.json(r) : NextResponse.json({ error: 'not found' }, { status: 404 })
      }
      case 'search':
        return NextResponse.json(await aiSearch(q.get('q') ?? '', Number(q.get('limit')) || 12))
      case 'trades':
        return NextResponse.json(await aiRequests(user.id))
      case 'auctions':
        return NextResponse.json(await aiAuctions(user.id))
      default:
        return NextResponse.json({ error: 'not found' }, { status: 404 })
    }
  } catch (err) {
    console.error('[api/v1]', err)
    return NextResponse.json({ error: 'server error' }, { status: 500 })
  }
}

/** Zápisy (tělo JSON). Chyby pravidel vrací 4xx s { error } v češtině, ať je asistent předá uživateli. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params
  const [a, b] = path
  const user = await userFromToken(tokenFromRequest(req, null))
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if ('error' in user) return NextResponse.json({ error: user.error }, { status: user.status })
  let body: Record<string, unknown> = {}
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Tělo musí být JSON.' }, { status: 400 })
  }
  const items = Array.isArray(body.items) ? (body.items as never[]) : []
  try {
    switch (`${a}/${b ?? ''}`) {
      case 'add/':
        return NextResponse.json(await aiAddCards(user, items))
      case 'quantity/':
        return NextResponse.json(await aiSetQuantity(user, body as never))
      case 'missing/':
        return NextResponse.json(await aiMarkMissing(user, items, { buy: body.buy as boolean | undefined, maxPriceCzk: body.maxPriceCzk as number | undefined }))
      case 'missing/remove':
        return NextResponse.json(await aiUnmarkMissing(user, items))
      case 'offer/':
        return NextResponse.json(await aiSetOffer(user, body as never))
      case 'offer/clear':
        return NextResponse.json(await aiClearOffer(user, body as never))
      default:
        return NextResponse.json({ error: 'not found' }, { status: 404 })
    }
  } catch (err) {
    if (err instanceof WriteFail) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error('[api/v1 POST]', err)
    return NextResponse.json({ error: 'server error' }, { status: 500 })
  }
}

const BASE = 'https://pokemon.jede.online'
function openapi() {
  const op = (summary: string, params: { name: string; required?: boolean; description?: string }[] = []) => ({
    get: {
      summary,
      parameters: params.map((p) => ({ name: p.name, in: 'query', required: !!p.required, description: p.description, schema: { type: 'string' } })),
      responses: { '200': { description: 'OK' } },
      security: [{ bearerAuth: [] }],
    },
  })
  const post = (summary: string, props: Record<string, unknown>, required: string[] = []) => ({
    post: {
      summary,
      requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: props, required } } } },
      responses: { '200': { description: 'OK' }, '400': { description: 'Chyba pravidel ({ error })' } },
      security: [{ bearerAuth: [] }],
    },
  })
  const pick = { cardId: { type: 'string', description: 'id karty, např. sv03.5-199 (přednostně)' }, query: { type: 'string', description: 'místo cardId: kód sady a číslo, např. "SVI 045"' } }
  const variant = { type: 'string', enum: ['NORMAL', 'HOLO', 'REVERSE', 'FIRST_EDITION', 'POKEBALL', 'MASTERBALL'], description: 'bez variant u karty s více variantami přijde status needs_variant s options' }
  const condition = { type: 'string', enum: ['MINT', 'LIGHT_PLAYED', 'DAMAGED'] }
  const language = { type: 'string', enum: ['en', 'de', 'fr', 'it', 'es', 'ja', 'ko', 'zh', 'other'] }
  const items = (props: Record<string, unknown>) => ({ type: 'array', maxItems: 20, items: { type: 'object', properties: props } })
  return {
    openapi: '3.1.0',
    info: { title: 'pokemon.jede.online – sbírka', version: '1.1.0', description: 'Sbírka Pokémon karet uživatele: co má, co mu chybí, ceny, výměny, aukce — a zápis: přidání karet, počty, „chybí“, nabídky. Před zápisem uživateli zopakuj, co uložíš. Klíč z Můj účet → Napojení na AI.' },
    servers: [{ url: `${BASE}/api/v1` }],
    components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } } },
    paths: {
      '/me': op('Přehled sbírky (počty, hodnota, postup v sadách)'),
      '/collection': op('Moje karty', [{ name: 'set', description: 'id sady, např. sv03.5' }, { name: 'limit' }]),
      '/missing': { ...op('Chybějící karty a kdo je nabízí', [{ name: 'set' }, { name: 'all', description: '1 = vše, co v sadě nemám (jen se set)' }]), ...post('Označit karty jako chybějící (až 20); buy=true = veřejná poptávka', { items: items(pick), buy: { type: 'boolean' }, maxPriceCzk: { type: 'integer' } }, ['items']) },
      '/sets': op('Seznam sad'),
      '/sets/{id}': { get: { summary: 'Detail sady s mým postupem', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'OK' } }, security: [{ bearerAuth: [] }] } },
      '/cards/{id}': { get: { summary: 'Detail karty', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'OK' } }, security: [{ bearerAuth: [] }] } },
      '/search': op('Hledat kartu podle jména nebo čísla', [{ name: 'q', required: true }, { name: 'limit' }]),
      '/trades': op('Moje žádosti o výměnu'),
      '/auctions': op('Moje aukce'),
      '/add': post('Přidat karty do sbírky (až 20)', { items: items({ ...pick, quantity: { type: 'integer', minimum: 1, maximum: 99 }, variant, condition, language, note: { type: 'string', maxLength: 30 } }) }, ['items']),
      '/quantity': post('Nastavit počet kusů (0 = odebrat)', { ...pick, quantity: { type: 'integer', minimum: 0, maximum: 999 }, variant, condition, language }, ['quantity']),
      '/missing/remove': post('Zrušit „chybí“ (až 20)', { items: items(pick) }, ['items']),
      '/offer': post('Nabídnout kusy navíc (TRADE / SELL s priceCzk / GIFT)', { ...pick, spare: { type: 'integer', minimum: 1 }, offerType: { type: 'string', enum: ['TRADE', 'SELL', 'GIFT'] }, priceCzk: { type: 'integer' }, variant, condition, language }, ['spare', 'offerType']),
      '/offer/clear': post('Zrušit nabídku u karty', pick),
    },
  }
}
