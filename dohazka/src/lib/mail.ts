import 'server-only'

const OD = 'Docházka <dohazka@jede.online>'

/**
 * Pošle e-mail přes Resend. NIKDY nevyhazuje a nikdy neblokuje úspěch volajícího:
 * bez RESEND_API_KEY, při chybě sítě i při odmítnutí vrací false.
 * Obsah (odkaz s tokenem) se nikam nelogují.
 */
let varovano = false

export async function sendMail(to: string, subject: string, html: string, text?: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    // Jednou za běh procesu: ať je v docker logs vidět, že e-maily (i obnova hesla) nejdou.
    if (!varovano) {
      varovano = true
      console.error('sendMail: chybí RESEND_API_KEY, e-maily se neodesílají (pozvánky ani obnova hesla nedorazí)')
    }
    return false
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: OD, to: [to], subject, html, ...(text ? { text } : {}) }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) console.error('sendMail: Resend odmítl odeslání, stav', res.status)
    return res.ok
  } catch (e) {
    console.error('sendMail: odeslání selhalo', e instanceof Error ? e.name : 'chyba')
    return false
  }
}
