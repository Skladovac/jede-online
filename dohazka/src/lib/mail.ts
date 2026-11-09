import 'server-only'

const OD = 'Docházka <dohazka@jede.online>'

/**
 * Pošle e-mail přes Resend. NIKDY nevyhazuje a nikdy neblokuje úspěch volajícího:
 * bez RESEND_API_KEY, při chybě sítě i při odmítnutí vrací false.
 * Obsah (odkaz s tokenem) se nikam nelogují.
 */
export async function sendMail(to: string, subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY
  if (!key) return false
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: OD, to: [to], subject, html }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) console.error('sendMail: Resend odmítl odeslání, stav', res.status)
    return res.ok
  } catch (e) {
    console.error('sendMail: odeslání selhalo', e instanceof Error ? e.name : 'chyba')
    return false
  }
}
