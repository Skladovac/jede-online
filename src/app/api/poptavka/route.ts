import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { prisma } from '@/lib/prisma'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  let body: Record<string, string>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Neplatný požadavek.' }, { status: 400 })
  }

  const { jmeno = '', prijmeni = '', firma = '', web = '', email = '', telefon = '', zprava = '' } = body

  if (!jmeno || !prijmeni || !email || !telefon || !zprava) {
    return NextResponse.json({ error: 'Vyplňte prosím všechna povinná pole.' }, { status: 400 })
  }
  if (!email.includes('@')) {
    return NextResponse.json({ error: 'Zadejte platnou e-mailovou adresu.' }, { status: 400 })
  }

  /* ── DB — neblokující (cold start Neon) ── */
  prisma.lead.upsert({
    where: { email },
    update: {},
    create: { email, source: 'poptavka' },
  }).catch(err => console.error('[poptavka] DB error:', err))

  /* ── Notifikace — KRITICKÁ. Tímto se k nám lead dostane. ──
     Pozor: doména jede.online nemá MX záznam, takže info@jede.online
     NENÍ doručitelná schránka. Cíl se nastavuje přes LEAD_NOTIFY_TO. */
  const notifyTo = process.env.LEAD_NOTIFY_TO || 'tomasnovosad@icloud.com'

  try {
    await resend.emails.send({
      from: 'jede.online <info@jede.online>',
      to: notifyTo,
      replyTo: email,
      subject: `Nová poptávka — ${jmeno} ${prijmeni}`,
      html: notificationHtml({ jmeno, prijmeni, firma, web, email, telefon, zprava }),
    })
  } catch (err) {
    console.error('[poptavka] KRITICKÁ CHYBA — notifikace neodešla:', err)
    return NextResponse.json(
      { error: 'Poptávku se nepodařilo odeslat. Zkuste to prosím znovu, nebo nám napište na info@skladovac.cz.' },
      { status: 500 }
    )
  }

  /* ── Potvrzení klientovi — nekritické. Lead už máme. ── */
  try {
    await resend.emails.send({
      from: 'jede.online <info@jede.online>',
      to: email,
      subject: 'Poptávku jsme přijali — ozveme se do 24 hodin',
      html: confirmationHtml({ jmeno, zprava }),
    })
  } catch (err) {
    console.error('[poptavka] potvrzení klientovi neodešlo:', err)
  }

  return NextResponse.json({ success: true })
}

/* ── HTML šablony ── */

function notificationHtml(d: {
  jmeno: string; prijmeni: string; firma: string; web: string
  email: string; telefon: string; zprava: string
}) {
  const rows = [
    ['Jméno', `${d.jmeno} ${d.prijmeni}`],
    ['E-mail', `<a href="mailto:${d.email}" style="color:#C9A961;">${d.email}</a>`],
    ['Telefon', d.telefon],
    ...(d.firma ? [['Firma', d.firma] as [string, string]] : []),
    ...(d.web ? [['Web', `<a href="${d.web}" style="color:#C9A961;">${d.web}</a>`] as [string, string]] : []),
  ]
  return `
    <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;background:#050508;color:#e2e8f0;border-radius:12px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#C9A961,#a8863d);padding:24px 32px;">
        <div style="font-size:20px;font-weight:700;color:#050508;">jede.online</div>
        <div style="font-size:13px;color:rgba(5,5,8,0.65);margin-top:4px;">Nová poptávka</div>
      </div>
      <div style="padding:32px;">
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          ${rows.map(([k, v]) => `<tr><td style="padding:8px 0;color:#94a3b8;width:130px;vertical-align:top;">${k}</td><td style="padding:8px 0;color:#f1f5f9;">${v}</td></tr>`).join('')}
        </table>
        <div style="margin-top:24px;padding:20px;background:rgba(255,255,255,0.04);border-radius:8px;border-left:3px solid #C9A961;">
          <div style="font-size:11px;color:#94a3b8;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.1em;">Zpráva</div>
          <div style="font-size:15px;color:#e2e8f0;line-height:1.7;">${d.zprava.replace(/\n/g, '<br>')}</div>
        </div>
      </div>
    </div>`
}

function confirmationHtml(d: { jmeno: string; zprava: string }) {
  return `
    <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;background:#050508;color:#e2e8f0;border-radius:12px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#C9A961,#a8863d);padding:24px 32px;">
        <div style="font-size:20px;font-weight:700;color:#050508;">jede.online</div>
      </div>
      <div style="padding:32px;">
        <h1 style="font-size:22px;font-weight:600;color:#f1f5f9;margin:0 0 16px;">
          Ahoj ${d.jmeno}, poptávku jsme přijali.
        </h1>
        <p style="font-size:15px;color:#94a3b8;line-height:1.75;margin:0 0 24px;">
          Ozveme se vám zpět do 24 hodin a společně vymyslíme nejlepší řešení pro váš byznys. Neformálně a bez závazků.
        </p>
        <div style="padding:20px;background:rgba(201,169,97,0.07);border:1px solid rgba(201,169,97,0.2);border-radius:8px;font-size:14px;color:#94a3b8;line-height:1.65;">
          <strong style="color:#C9A961;">Vaše zpráva:</strong><br><br>
          ${d.zprava.replace(/\n/g, '<br>')}
        </div>
        <p style="margin-top:28px;font-size:13px;color:#475569;">
          Dotaz? Napište na <a href="mailto:info@jede.online" style="color:#C9A961;">info@jede.online</a>
        </p>
      </div>
    </div>`
}
