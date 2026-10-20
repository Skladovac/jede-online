import { NextResponse, type NextRequest } from 'next/server'
import { tokenFromRequest, userFromToken } from '@/lib/api-auth'
import { aiAuctions, aiCard, aiCollection, aiMissing, aiOverview, aiRequests, aiSearch, aiSets } from '@/lib/ai-data'

export const dynamic = 'force-dynamic'

/**
 * REST pro AI asistenty a „vlastní GPT“ (jen čtení). Klíč jen v hlavičce Authorization: Bearer pk_….
 *   GET /api/v1/me · /collection?set=sv01 · /missing?set=sv01&all=1 · /sets · /sets/{id} · /cards/{id} · /search?q=… · /trades · /auctions
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
  return {
    openapi: '3.1.0',
    info: { title: 'pokemon.jede.online – sbírka (jen čtení)', version: '1.0.0', description: 'Sbírka Pokémon karet uživatele: co má, co mu chybí, ceny, výměny, aukce. Klíč z Můj účet → Napojení na AI.' },
    servers: [{ url: `${BASE}/api/v1` }],
    components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } } },
    paths: {
      '/me': op('Přehled sbírky (počty, hodnota, postup v sadách)'),
      '/collection': op('Moje karty', [{ name: 'set', description: 'id sady, např. sv03.5' }, { name: 'limit' }]),
      '/missing': op('Chybějící karty a kdo je nabízí', [{ name: 'set' }, { name: 'all', description: '1 = vše, co v sadě nemám (jen se set)' }]),
      '/sets': op('Seznam sad'),
      '/sets/{id}': { get: { summary: 'Detail sady s mým postupem', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'OK' } }, security: [{ bearerAuth: [] }] } },
      '/cards/{id}': { get: { summary: 'Detail karty', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'OK' } }, security: [{ bearerAuth: [] }] } },
      '/search': op('Hledat kartu podle jména nebo čísla', [{ name: 'q', required: true }, { name: 'limit' }]),
      '/trades': op('Moje žádosti o výměnu'),
      '/auctions': op('Moje aukce'),
    },
  }
}
