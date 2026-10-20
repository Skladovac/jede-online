import { NextResponse } from 'next/server'
import { tokenFromRequest, userFromToken } from '@/lib/api-auth'
import { handleMcp } from '@/lib/mcp-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * MCP endpoint pro AI asistenty: POST /mcp (klíč v hlavičce Authorization: Bearer pk_…)
 * nebo POST /mcp/pk_… (klíč v adrese — ChatGPT a Claude konektory vlastní hlavičku neumí).
 */
async function run(req: Request, ctx: { params: Promise<{ token?: string[] }> }) {
  const { token } = await ctx.params
  // Otevření adresy v prohlížeči nebo vložení do chatu (GET bez MCP hlaviček): místo chyby 406 srozumitelný návod.
  if (req.method === 'GET' && !(req.headers.get('accept') ?? '').includes('text/event-stream'))
    return NextResponse.json(
      {
        note: 'Tohle je MCP server pro AI asistenty, ne webová stránka. Adresu přidej v ChatGPT jako konektor: Nastavení → Aplikace a konektory → Pokročilé → Režim pro vývojáře → Vytvořit → adresa MCP serveru = tato adresa, ověření „Bez ověření“. V Claude: Nastavení → Konektory → Přidat vlastní konektor.',
        docs: 'https://pokemon.jede.online/ucet#ai',
        openapi: 'https://pokemon.jede.online/api/v1/openapi.json',
      },
      { status: 200 },
    )
  const user = await userFromToken(tokenFromRequest(req, token?.[0]))
  if (!user) return NextResponse.json({ error: 'Neplatný nebo zrušený klíč. Nový vytvoříš v Můj účet → Napojení na AI.' }, { status: 401 })
  if ('error' in user) return NextResponse.json({ error: user.error }, { status: user.status })
  return handleMcp(req, user)
}

export const POST = run
export const GET = run
export const DELETE = run
