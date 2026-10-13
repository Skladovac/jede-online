import 'server-only'
import { prisma } from '@/lib/prisma'
import { SITE_URL } from '@/lib/site'

const FROM = { name: 'Web VRM', email: 'noreply@jede.online' }

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

/** Kam posílat upozornění: LEAD_EMAILS z env, jinak veřejné e-maily makléřů. */
async function recipients(preferUserId?: string | null) {
  const env = (process.env.LEAD_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (env.length) return env
  const users = await prisma.user.findMany({ select: { id: true, publicEmail: true, email: true } })
  const list = users.map((u) => ({ id: u.id, email: u.publicEmail || u.email }))
  // Makléř nemovitosti jako první příjemce, druhý v kopii.
  list.sort((a, b) => Number(b.id === preferUserId) - Number(a.id === preferUserId))
  return list.map((u) => u.email)
}

/**
 * Upozornění makléřům na novou poptávku. Odpověď (Reply-To) jde rovnou zájemci.
 * Bez BREVO_API_KEY (lokální vývoj) se jen vypíše do logu.
 */
export async function notifyLead(opts: {
  subject: string
  rows: [string, string][]
  replyTo?: { email: string; name: string }
  agentId?: string | null
  adminPath: string
}) {
  const to = await recipients(opts.agentId)
  if (!to.length) return
  const html = `<!doctype html><html lang="cs"><body style="margin:0;background:#f9f9f9;font-family:-apple-system,Segoe UI,sans-serif;color:#001a3b">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr><td align="center" style="padding:32px 16px">
<table width="560" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;width:100%;background:#fff;border-radius:4px;border-top:4px solid #c5a880">
<tr><td style="padding:28px 32px">
<p style="margin:0 0 4px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#8b6b3d">Vaši realitní makléři</p>
<h1 style="margin:0 0 20px;font-size:20px;font-weight:600">${esc(opts.subject)}</h1>
<table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border-collapse:collapse">
${opts.rows
  .filter(([, v]) => v)
  .map(
    ([k, v]) =>
      `<tr><td style="padding:8px 12px 8px 0;border-bottom:1px solid #eee;color:#5c6575;font-size:14px;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:8px 0;border-bottom:1px solid #eee;font-size:15px;white-space:pre-wrap">${esc(v)}</td></tr>`,
  )
  .join('')}
</table>
<p style="margin:24px 0 0"><a href="${esc(SITE_URL + opts.adminPath)}" style="display:inline-block;background:#001a3b;color:#fff;text-decoration:none;padding:12px 20px;border-radius:2px;font-weight:600">Otevřít v administraci</a></p>
<p style="margin:20px 0 0;font-size:12px;color:#9aa1ad">Odpovědí na tento e-mail napíšete přímo zájemci.</p>
</td></tr></table></td></tr></table></body></html>`

  const key = process.env.BREVO_API_KEY
  if (!key) {
    console.log(`[email] (bez API klíče) → ${to.join(', ')}: ${opts.subject}\n${opts.rows.map(([k, v]) => `  ${k}: ${v}`).join('\n')}`)
    return
  }
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': key, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        sender: FROM,
        to: [{ email: to[0] }],
        ...(to.length > 1 && { cc: to.slice(1).map((email) => ({ email })) }),
        ...(opts.replyTo?.email && { replyTo: opts.replyTo }),
        subject: opts.subject,
        htmlContent: html,
      }),
    })
    if (!res.ok) console.error('[email] Brevo selhal', res.status, await res.text())
  } catch (err) {
    // Poptávka je uložená v DB i bez e-mailu — chyba odeslání nesmí shodit formulář.
    console.error('[email] odeslání selhalo', err)
  }
}
