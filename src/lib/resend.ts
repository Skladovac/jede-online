import { Resend } from 'resend'

let client: Resend | null = null

/**
 * Klient se vyrábí až při prvním odeslání, ne při importu modulu.
 *
 * `new Resend(undefined)` hází výjimku. Na úrovni modulu tím shodí `next build`
 * ve fázi "collect page data", protože build žádný RESEND_API_KEY nemá — a mít
 * ho nemusí, je to runtime tajemství. Na Vercelu to nebylo vidět, protože ten
 * proměnné z projektu dosazuje i do buildu.
 */
export function getResend(): Resend {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('RESEND_API_KEY není nastavený.')
  if (!client) client = new Resend(key)
  return client
}
