import 'server-only'
import { tFor } from '@/lib/i18n/server'
import { LOCALE_INFO, isLocale } from '@/lib/i18n/config'

// Kontakt webu: přeposílá se přes ImprovMX do Gmailu správce.
export const CONTACT_EMAIL = 'pokemon@jede.online'
// Kam chodí nahlášení uživatelů. Přímo do schránky správce (ADMIN_EMAIL v env na serveru, mimo git),
// protože zprávy z Brevo na pokemon@ může ImprovMX odmítnout kvůli blacklistům sdílených IP.
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || CONTACT_EMAIL
export const APP_URL = process.env.APP_URL ?? 'https://pokemon.jede.online'
const FROM = { name: 'Pokémon karty', email: 'noreply@jede.online' }

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

/** Odeslání přes Brevo (nebo Resend). Bez API klíče (lokální vývoj) se e-mail jen vypíše do logu. */
async function send(
  to: string,
  subject: string,
  paragraphs: string[],
  button?: { label: string; url: string },
  cc: string[] = [],
  locale: string = 'cs',
): Promise<boolean> {
  const tt = tFor(locale)
  const from = { ...FROM, name: tt('Pokémon karty') }
  cc = [...new Set(cc.filter((c) => c && c !== to))]
  const html = `<!doctype html><html lang="${isLocale(locale) ? LOCALE_INFO[locale].htmlLang : 'cs'}"><body style="margin:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,sans-serif;color:#0f172a">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr><td align="center" style="padding:32px 16px">
<table width="520" cellpadding="0" cellspacing="0" role="presentation" style="max-width:520px;width:100%;background:#fff;border-radius:16px">
<tr><td style="padding:32px">
<p style="margin:0 0 24px;font-weight:700"><span style="display:inline-block;width:24px;height:24px;line-height:24px;text-align:center;border-radius:12px;background:#facc15">★</span> ${esc(tt('Pokémon karty'))}</p>
${paragraphs.map((p) => `<p style="margin:0 0 16px;line-height:1.6">${p}</p>`).join('')}
${button ? `<p style="margin:24px 0"><a href="${esc(button.url)}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600">${esc(button.label)}</a></p><p style="margin:0 0 16px;font-size:12px;color:#64748b;word-break:break-all">${tt('Nebo zkopírujte odkaz:')} ${esc(button.url)}</p>` : ''}
<p style="margin:24px 0 0;font-size:12px;color:#64748b">${tt('Tento e-mail byl odeslán automaticky z pokemon.jede.online. Pokud jste o nic nežádali, můžete ho ignorovat.')}</p>
</td></tr></table></td></tr></table></body></html>`

  // Brevo (zdarma 300 e-mailů/den, víc domén). Resend jen jako záloha — free tarif má jedinou doménu.
  const brevo = process.env.BREVO_API_KEY
  const resend = process.env.RESEND_API_KEY
  if (!brevo && !resend) {
    console.log(`[email] (bez API klíče) → ${to}${cc.length ? ` (kopie ${cc.join(', ')})` : ''}: ${subject}${button ? `
  ${button.url}` : ''}`)
    return true
  }
  const res = brevo
    ? await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': brevo, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          sender: from,
          // Odpověď na automatický e-mail dojde na kontakt webu, ne do prázdna.
          replyTo: { email: CONTACT_EMAIL },
          to: [{ email: to }],
          ...(cc.length && { cc: cc.map((email) => ({ email })) }),
          subject,
          htmlContent: html,
        }),
      })
    : await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resend}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: `${from.name} <${from.email}>`, to, ...(cc.length && { cc }), subject, html }),
      })
  if (!res.ok) console.error(`[email] ${brevo ? 'Brevo' : 'Resend'} selhal`, res.status, await res.text())
  return res.ok
}

export function sendVerifyEmail(to: string, nickname: string, token: string, next?: string | null, locale: string = 'cs') {
  const tt = tFor(locale)
  return send(
    to,
    tt('Potvrď svůj e-mail'),
    [tt('Ahoj <strong>{name}</strong>,', { name: esc(nickname) }), tt('díky za registraci. Potvrď prosím, že tento e-mail patří tobě.')],
    // next = kam se po potvrzení vrátit (např. stránka hodnocení, ze které přišel).
    { label: tt('Potvrdit e-mail'), url: `${APP_URL}/overeni/${token}${next ? `?next=${encodeURIComponent(next)}` : ''}` },
    [],
    locale,
  )
}

/** Rodičovské e-maily jdou v jazyce dítěte (locale účtu dítěte). */
export function sendParentConsentEmail(to: string, nickname: string, parentToken: string, locale: string = 'cs') {
  const tt = tFor(locale)
  return send(
    to,
    tt('Žádost o souhlas: účet „{name}“ na Pokémon karty', { name: nickname }),
    [
      tt('Dobrý den,'),
      tt(
        'vaše dítě si na webu <strong>pokemon.jede.online</strong> založilo účet s přezdívkou <strong>{name}</strong> a uvedlo tento e-mail jako e-mail rodiče.',
        { name: esc(nickname) },
      ),
      tt('Web slouží k evidenci sbírky Pokémon karet a k domluvě výměn mezi sběrateli. Bez vašeho souhlasu zůstane účet omezený: profil není vidět a dítě nemůže posílat ani přijímat nabídky.'),
      tt('Na odkazu níže uvidíte, jaké údaje dítě zadalo, a můžete souhlas udělit, údaje upravit nebo účet smazat. Odkaz si uschovejte — slouží i pro pozdější správu účtu.'),
    ],
    { label: tt('Zobrazit účet a rozhodnout'), url: `${APP_URL}/rodic/${parentToken}` },
    [],
    locale,
  )
}

export function sendResetEmail(to: string, token: string, locale: string = 'cs') {
  const tt = tFor(locale)
  return send(
    to,
    tt('Obnovení hesla'),
    [tt('Někdo (snad ty) požádal o nové heslo. Odkaz platí 1 hodinu.')],
    { label: tt('Nastavit nové heslo'), url: `${APP_URL}/nove-heslo/${token}` },
    [],
    locale,
  )
}

export function sendPasswordChangedEmail(to: string, nickname: string, locale: string = 'cs') {
  const tt = tFor(locale)
  return send(
    to,
    tt('Heslo bylo změněno'),
    [
      tt('Ahoj <strong>{name}</strong>,', { name: esc(nickname) }),
      tt('heslo k tvému účtu na pokemon.jede.online bylo právě změněno a ostatní přihlášená zařízení jsme odhlásili.'),
      tt('Pokud jsi to nebyl(a) ty, nastav si hned nové heslo přes „Zapomenuté heslo“ a napiš nám na pokemon@jede.online.'),
    ],
    { label: tt('Zapomenuté heslo'), url: `${APP_URL}/zapomenute-heslo` },
    [],
    locale,
  )
}

export function sendParentLinksEmail(to: string, nickname: string, parentToken: string, locale: string = 'cs') {
  const tt = tFor(locale)
  return send(
    to,
    tt('„{name}“ přidal(a) odkazy na sociální sítě', { name: nickname }),
    [
      tt(
        'Účet <strong>{name}</strong> má na profilu nové odkazy (Facebook, Instagram, Aukro). Zobrazí se ostatním až po vašem schválení.',
        { name: esc(nickname) },
      ),
    ],
    { label: tt('Zkontrolovat a schválit'), url: `${APP_URL}/rodic/${parentToken}` },
    [],
    locale,
  )
}

/** Obecné upozornění (poptávky). U nezletilého jde kopie rodiči — viz parentCc(). Texty překládá volající (tFor(locale) příjemce). */
export function notify(
  to: string,
  cc: string[],
  subject: string,
  paragraphs: string[],
  button?: { label: string; url: string },
  locale: string = 'cs',
) {
  return send(to, subject, paragraphs, button, cc, locale)
}
