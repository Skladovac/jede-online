import 'server-only'
import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { aiAuctions, aiCard, aiCollection, aiMissing, aiOverview, aiRequests, aiSearch, aiSets } from '@/lib/ai-data'
import type { ApiUser } from '@/lib/api-auth'

/**
 * MCP server pro AI asistenty (ChatGPT, Claude…): jen čtení sbírky přihlášeného podle osobního klíče.
 * Bezstavový (každý požadavek nový server + transport) — běží v Next.js route bez session.
 */
const json = (data: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(data, null, 1) }] })

export function buildMcpServer(user: ApiUser) {
  const server = new McpServer({ name: 'pokemon.jede.online', version: '1.0.0' }, { instructions: `Sbírka Pokémon karet uživatele ${user.nickname} na pokemon.jede.online. Všechny nástroje jsou jen pro čtení. Ceny jsou orientační (Cardmarket, EUR + přepočet na Kč).` })

  server.registerTool(
    'ping',
    { title: 'Test spojení', description: 'Ověří, že spojení s pokemon.jede.online funguje. Vrátí ok, verzi serveru a přezdívku uživatele (bez citlivých údajů).', inputSchema: {} },
    async () => json({ ok: true, server: 'pokemon.jede.online', version: '1.0.0', user: user.nickname, time: new Date().toISOString() }),
  )

  server.registerTool('my_overview', { title: 'Přehled sbírky', description: 'Souhrn: počet karet, hodnota sbírky, kolik chybí, postup po sadách (base / complete / master).', inputSchema: {} }, async () => json(await aiOverview(user.id, user.nickname)))

  server.registerTool(
    'my_cards',
    { title: 'Moje karty', description: 'Karty ve sbírce s počtem kusů, variantou, stavem, cenou a případnou nabídkou. Volitelně jen jedna sada (setId, např. "sv03.5").', inputSchema: { setId: z.string().optional(), limit: z.number().int().min(1).max(2000).optional() } },
    async ({ setId, limit }) => json(await aiCollection(user.id, setId, limit ?? 500)),
  )

  server.registerTool(
    'my_missing',
    { title: 'Chybějící karty', description: 'Karty, které uživatel sháni (označené „Chybí“), s cenou a tím, kdo je na webu nabízí. S allInSet=true a setId vrátí vše, co v dané sadě nemá.', inputSchema: { setId: z.string().optional(), allInSet: z.boolean().optional() } },
    async ({ setId, allInSet }) => json(await aiMissing(user.id, setId, !!allInSet)),
  )

  server.registerTool(
    'sets',
    { title: 'Sady', description: 'Seznam sad v katalogu (bez setId), nebo detail jedné sady s postupem uživatele.', inputSchema: { setId: z.string().optional() } },
    async ({ setId }) => json(await aiSets(user.id, setId)),
  )

  server.registerTool(
    'search_cards',
    { title: 'Hledat kartu', description: 'Hledání v katalogu podle jména nebo čísla (např. "Charizard", "SVI 045", "199/165").', inputSchema: { query: z.string().min(2).max(60), limit: z.number().int().min(1).max(30).optional() } },
    async ({ query, limit }) => json(await aiSearch(query, limit ?? 12)),
  )

  server.registerTool(
    'card',
    { title: 'Detail karty', description: 'Detail karty podle id (např. "sv03.5-199"): varianty, ceny, kolik lidí ji nabízí a zda ji uživatel má.', inputSchema: { cardId: z.string() } },
    async ({ cardId }) => json((await aiCard(cardId, user.id)) ?? { error: 'Karta nenalezena' }),
  )

  server.registerTool('my_trades', { title: 'Moje výměny', description: 'Žádosti o výměnu (odeslané i přijaté) a jejich stav.', inputSchema: {} }, async () => json(await aiRequests(user.id)))
  server.registerTool('my_auctions', { title: 'Moje aukce', description: 'Aukce, které uživatel založil (odkazy na Facebook, Aukro…).', inputSchema: {} }, async () => json(await aiAuctions(user.id)))

  // „search“ a „fetch“ podle konvence ChatGPT konektorů (vyžaduje je pro některé režimy).
  server.registerTool(
    'search',
    { title: 'Search', description: 'Search cards in the catalogue. Returns ids usable with "fetch".', inputSchema: { query: z.string() } },
    async ({ query }) => {
      const hits = await aiSearch(query, 10)
      return json({ results: hits.map((h) => ({ id: h.id, title: `${h.name} (${h.set.name} ${h.number})`, url: h.url })) })
    },
  )
  server.registerTool(
    'fetch',
    { title: 'Fetch', description: 'Fetch full detail of a card by id.', inputSchema: { id: z.string() } },
    async ({ id }) => {
      const c = await aiCard(id, user.id)
      return json(c ? { id: c.id, title: c.name, text: JSON.stringify(c), url: c.url } : { error: 'not found' })
    },
  )
  return server
}

/** Vyřídí jeden HTTP požadavek MCP (bezstavově, odpověď JSON). */
export async function handleMcp(req: Request, user: ApiUser) {
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
  const server = buildMcpServer(user)
  await server.connect(transport)
  try {
    return await transport.handleRequest(req)
  } finally {
    // Bez session: po odpovědi server zavřít, ať nic nezůstane v paměti.
    setTimeout(() => void server.close().catch(() => {}), 0)
  }
}
