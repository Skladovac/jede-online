import 'server-only'
import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { aiAuctions, aiCard, aiCollection, aiMissing, aiOverview, aiRequests, aiSearch, aiSets } from '@/lib/ai-data'
import { aiAddCards, aiClearOffer, aiMarkMissing, aiSetOffer, aiSetQuantity, aiUnmarkMissing, MAX_BATCH, WriteFail } from '@/lib/ai-write'
import type { ApiUser } from '@/lib/api-auth'

/**
 * MCP server pro AI asistenty (ChatGPT, Claude…): čtení i zápis do sbírky přihlášeného podle osobního klíče.
 * Bezstavový (každý požadavek nový server + transport) — běží v Next.js route bez session.
 */
const json = (data: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(data, null, 1) }] })
/** Zápis: chyby pravidel (limit, neověřený e-mail…) vrátí jako výsledek s isError, ať je asistent umí přečíst uživateli. */
async function write(fn: () => Promise<unknown>) {
  try {
    return json(await fn())
  } catch (err) {
    if (err instanceof WriteFail) return { ...json({ error: err.message }), isError: true }
    throw err
  }
}
const cardPick = { cardId: z.string().optional().describe('id karty z katalogu, např. "sv03.5-199" (přednostně)'), query: z.string().min(2).max(60).optional().describe('místo cardId: kód sady a číslo z karty, např. "SVI 045", "CEL CC025", nebo "Charizard 199/165"') }
const variantArg = z.enum(['NORMAL', 'HOLO', 'REVERSE', 'FIRST_EDITION', 'POKEBALL', 'MASTERBALL']).optional().describe('varianta; když ji neznáš a karta má víc variant, server vrátí needs_variant — zeptej se uživatele')
const conditionArg = z.enum(['MINT', 'LIGHT_PLAYED', 'DAMAGED']).optional().describe('stav, výchozí MINT')
const languageArg = z.enum(['en', 'de', 'fr', 'it', 'es', 'ja', 'ko', 'zh', 'other']).optional().describe('jazyk karty, výchozí en')

export function buildMcpServer(user: ApiUser) {
  const server = new McpServer({ name: 'pokemon.jede.online', version: '1.0.0' }, { instructions: [
      `Sbírka Pokémon karet uživatele ${user.nickname} na pokemon.jede.online. Ceny jsou orientační (Cardmarket, EUR + přepočet na Kč).`,
      'Nástroje add_cards, set_quantity, mark_missing, unmark_missing, set_offer a clear_offer ZAPISUJÍ do sbírky uživatele.',
      'Před zápisem uživateli stručně zopakuj, co uložíš (název, číslo a sada, varianta, počet), a ulož až po jeho potvrzení.',
      'Když nástroj vrátí status needs_variant, zeptej se uživatele na variantu (normální / holo / reverse holo…) a zavolej znovu s variant. Při ambiguous se zeptej, kterou kartu myslí.',
      'Kartu z fotky poznáš podle jména, čísla v levém dolním rohu (např. 045/198) a kódu sady; nejdřív ji ověř přes search_cards, pak přidej přes add_cards s cardId.',
    ].join(' ') })

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

  // ── Zápis ──
  server.registerTool(
    'add_cards',
    {
      title: 'Přidat karty do sbírky',
      description: `Přidá karty do sbírky uživatele (až ${MAX_BATCH} najednou, např. celá stránka alba). Každá položka: cardId nebo query, quantity (výchozí 1), variant, condition, language, note. Bez variant u karty s více variantami vrátí needs_variant — zeptej se uživatele. Karta tím přestane být „chybí“.`,
      inputSchema: {
        items: z.array(z.object({ ...cardPick, quantity: z.number().int().min(1).max(99).optional(), variant: variantArg, condition: conditionArg, language: languageArg, note: z.string().max(30).optional() })).min(1).max(MAX_BATCH),
      },
    },
    async ({ items }) => write(() => aiAddCards(user, items)),
  )
  server.registerTool(
    'set_quantity',
    { title: 'Změnit počet kusů', description: 'Nastaví počet kusů karty ve sbírce (0 = odebrat ze sbírky). Volitelně upřesni variant / condition / language, když má uživatel kartu ve více řádcích.', inputSchema: { ...cardPick, quantity: z.number().int().min(0).max(999), variant: variantArg, condition: conditionArg, language: languageArg } },
    async (a) => write(() => aiSetQuantity(user, a)),
  )
  server.registerTool(
    'mark_missing',
    { title: 'Označit „chybí“', description: `Označí karty jako chybějící (až ${MAX_BATCH}). S buy=true vznikne veřejná poptávka „koupím“ (volitelně maxPriceCzk) — vyžaduje potvrzený e-mail.`, inputSchema: { items: z.array(z.object(cardPick)).min(1).max(MAX_BATCH), buy: z.boolean().optional(), maxPriceCzk: z.number().int().min(1).max(1_000_000).optional() } },
    async ({ items, buy, maxPriceCzk }) => write(() => aiMarkMissing(user, items, { buy, maxPriceCzk })),
  )
  server.registerTool(
    'unmark_missing',
    { title: 'Zrušit „chybí“', description: `Odebere karty ze seznamu chybějících (až ${MAX_BATCH}).`, inputSchema: { items: z.array(z.object(cardPick)).min(1).max(MAX_BATCH) } },
    async ({ items }) => write(() => aiUnmarkMissing(user, items)),
  )
  server.registerTool(
    'set_offer',
    { title: 'Nabídnout kusy navíc', description: 'Nabídne kusy navíc karty, kterou uživatel má: spare = kolik kusů, offerType TRADE (vyměním) / SELL (prodám, nutná priceCzk) / GIFT (daruji za poštovné). Jen s potvrzeným e-mailem; dětský účet po souhlasu rodiče.', inputSchema: { ...cardPick, spare: z.number().int().min(1).max(999), offerType: z.enum(['TRADE', 'SELL', 'GIFT']), priceCzk: z.number().int().min(1).max(1_000_000).optional(), variant: variantArg, condition: conditionArg, language: languageArg } },
    async (a) => write(() => aiSetOffer(user, a)),
  )
  server.registerTool(
    'clear_offer',
    { title: 'Zrušit nabídku', description: 'Zruší nabídku kusů navíc u karty (karta ve sbírce zůstává).', inputSchema: cardPick },
    async (a) => write(() => aiClearOffer(user, a)),
  )

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
