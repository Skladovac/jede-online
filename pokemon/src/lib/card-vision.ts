import 'server-only'

/**
 * Rozpoznání karty z fotky přes OpenAI (model s obrázky). Vrací jen to, co je na kartě vytištěné:
 * jméno, kód sady (vlevo dole), číslo a počet za lomítkem. Párování s katalogem dělá volající (searchCards).
 * Klíč OPENAI_API_KEY je v pokemon.env (projektový klíč s oprávněním jen na Responses).
 */
export type CardReading = { name: string; setCode: string | null; number: string | null; total: string | null; language: string }

const MODEL = 'gpt-5.4-mini'

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'setCode', 'number', 'total', 'language'],
  properties: {
    name: { type: 'string' },
    setCode: { type: ['string', 'null'] },
    number: { type: ['string', 'null'] },
    total: { type: ['string', 'null'] },
    language: { type: 'string' },
  },
}

export const visionEnabled = () => !!process.env.OPENAI_API_KEY

export async function readCardPhoto(image: Buffer, mime: string): Promise<CardReading | null> {
  const key = process.env.OPENAI_API_KEY
  if (!key) return null
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(30_000),
    body: JSON.stringify({
      model: MODEL,
      reasoning: { effort: 'none' },
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text:
                'Read this Pokémon TCG card photo. Return the card name in English as printed (for Japanese cards the English name of the Pokémon/card), ' +
                'the set code printed at the bottom left (e.g. SVI, MEP, 30C, PAL) or null if not visible, the card number and the total after the slash ' +
                '(null if there is none). language: the language the card is PRINTED in (en = English text on the card, ja = Japanese text), or other. ' +
                'If the photo does not show a Pokémon card, return name "".',
            },
            { type: 'input_image', image_url: `data:${mime};base64,${image.toString('base64')}`, detail: 'high' },
          ],
        },
      ],
      text: { format: { type: 'json_schema', name: 'card', schema, strict: true } },
    }),
  })
  if (!res.ok) {
    console.error('[rozpoznani-karty]', res.status, (await res.text()).slice(0, 300))
    return null
  }
  const data = (await res.json()) as { output?: { type: string; content?: { type: string; text?: string }[] }[] }
  const text = data.output?.flatMap((o) => (o.type === 'message' ? (o.content ?? []) : [])).find((c) => c.type === 'output_text')?.text
  if (!text) return null
  try {
    const r = JSON.parse(text) as CardReading
    // Model občas vrátí „?“ místo null — čísla bereme jen když v nich něco je.
    const clean = (v: string | null) => (v && /[0-9A-Za-z]/.test(v) ? v.trim() : null)
    const out = { ...r, setCode: clean(r.setCode), number: clean(r.number), total: r.total && /^\d+$/.test(r.total.trim()) ? r.total.trim() : null }
    return out.name || out.number ? out : null
  } catch {
    return null
  }
}
