import 'server-only'

export const APP_URL = process.env.APP_URL ?? 'https://pokemon.jede.online'
const FROM = 'Pokémon karty <noreply@jede.online>'

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

/** Odeslání přes Resend REST API. Bez RESEND_API_KEY (lokální vývoj) se e-mail jen vypíše do logu. */
async function send(to: string, subject: string, paragraphs: string[], button?: { label: string; url: string }) {
  const html = `<!doctype html><html lang="cs"><body style="margin:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,sans-serif;color:#0f172a">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr><td align="center" style="padding:32px 16px">
<table width="520" cellpadding="0" cellspacing="0" role="presentation" style="max-width:520px;width:100%;background:#fff;border-radius:16px">
<tr><td style="padding:32px">
<p style="margin:0 0 24px;font-weight:700"><span style="display:inline-block;width:24px;height:24px;line-height:24px;text-align:center;border-radius:12px;background:#facc15">★</span> Pokémon karty</p>
${paragraphs.map((p) => `<p style="margin:0 0 16px;line-height:1.6">${p}</p>`).join('')}
${button ? `<p style="margin:24px 0"><a href="${esc(button.url)}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600">${esc(button.label)}</a></p><p style="margin:0 0 16px;font-size:12px;color:#64748b;word-break:break-all">Nebo zkopírujte odkaz: ${esc(button.url)}</p>` : ''}
<p style="margin:24px 0 0;font-size:12px;color:#64748b">Tento e-mail byl odeslán automaticky z pokemon.jede.online. Pokud jste o nic nežádali, můžete ho ignorovat.</p>
</td></tr></table></td></tr></table></body></html>`

  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.log(`[email] (bez RESEND_API_KEY) → ${to}: ${subject}${button ? `\n  ${button.url}` : ''}`)
    return
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  })
  if (!res.ok) console.error('[email] Resend selhal', res.status, await res.text())
}

export function sendVerifyEmail(to: string, nickname: string, token: string) {
  return send(
    to,
    'Potvrď svůj e-mail',
    [`Ahoj <strong>${esc(nickname)}</strong>,`, 'díky za registraci. Potvrď prosím, že tento e-mail patří tobě.'],
    { label: 'Potvrdit e-mail', url: `${APP_URL}/overeni/${token}` },
  )
}

export function sendParentConsentEmail(to: string, nickname: string, parentToken: string) {
  return send(
    to,
    `Žádost o souhlas: účet „${nickname}“ na Pokémon karty`,
    [
      'Dobrý den,',
      `vaše dítě si na webu <strong>pokemon.jede.online</strong> založilo účet s přezdívkou <strong>${esc(nickname)}</strong> a uvedlo tento e-mail jako e-mail rodiče.`,
      'Web slouží k evidenci sbírky Pokémon karet a k domluvě výměn mezi sběrateli. Bez vašeho souhlasu zůstane účet omezený: profil není vidět a dítě nemůže posílat ani přijímat nabídky.',
      'Na odkazu níže uvidíte, jaké údaje dítě zadalo, a můžete souhlas udělit, údaje upravit nebo účet smazat. Odkaz si uschovejte — slouží i pro pozdější správu účtu.',
    ],
    { label: 'Zobrazit účet a rozhodnout', url: `${APP_URL}/rodic/${parentToken}` },
  )
}

export function sendResetEmail(to: string, token: string) {
  return send(to, 'Obnovení hesla', ['Někdo (snad ty) požádal o nové heslo. Odkaz platí 1 hodinu.'], {
    label: 'Nastavit nové heslo',
    url: `${APP_URL}/nove-heslo/${token}`,
  })
}

export function sendParentLinksEmail(to: string, nickname: string, parentToken: string) {
  return send(
    to,
    `„${nickname}“ přidal(a) odkazy na sociální sítě`,
    [
      `Účet <strong>${esc(nickname)}</strong> má na profilu nové odkazy (Facebook, Instagram, Aukro). Zobrazí se ostatním až po vašem schválení.`,
    ],
    { label: 'Zkontrolovat a schválit', url: `${APP_URL}/rodic/${parentToken}` },
  )
}
