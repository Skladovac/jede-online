import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { prisma } from '@/lib/prisma'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  try {
    const { jmeno, prijmeni, firma, web, email, telefon, zprava } = await req.json()

    if (!jmeno || !prijmeni || !email || !telefon || !zprava) {
      return NextResponse.json({ error: 'Vyplňte prosím všechna povinná pole.' }, { status: 400 })
    }
    if (!email.includes('@')) {
      return NextResponse.json({ error: 'Zadejte platnou e-mailovou adresu.' }, { status: 400 })
    }

    /* ── Uložit Lead do DB ── */
    await prisma.lead.upsert({
      where: { email },
      update: {},
      create: { email, source: 'poptavka' },
    })

    /* ── Notifikace na info@jede.online ── */
    await resend.emails.send({
      from: 'jede.online <info@jede.online>',
      to: 'info@jede.online',
      subject: `Nová poptávka od ${jmeno} ${prijmeni}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;background:#050508;color:#e2e8f0;border-radius:12px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#C9A961,#a8863d);padding:24px 32px;">
            <div style="font-size:20px;font-weight:700;color:#050508;letter-spacing:-0.02em;">
              jede<span style="opacity:0.6">.</span>online
            </div>
            <div style="font-size:13px;color:rgba(5,5,8,0.65);margin-top:4px;letter-spacing:0.05em;">
              Nová poptávka
            </div>
          </div>
          <div style="padding:32px;">
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <tr><td style="padding:8px 0;color:#94a3b8;width:140px;">Jméno</td><td style="padding:8px 0;color:#f1f5f9;">${jmeno} ${prijmeni}</td></tr>
              <tr><td style="padding:8px 0;color:#94a3b8;">E-mail</td><td style="padding:8px 0;"><a href="mailto:${email}" style="color:#C9A961;">${email}</a></td></tr>
              <tr><td style="padding:8px 0;color:#94a3b8;">Telefon</td><td style="padding:8px 0;color:#f1f5f9;">${telefon}</td></tr>
              ${firma ? `<tr><td style="padding:8px 0;color:#94a3b8;">Firma</td><td style="padding:8px 0;color:#f1f5f9;">${firma}</td></tr>` : ''}
              ${web ? `<tr><td style="padding:8px 0;color:#94a3b8;">Web</td><td style="padding:8px 0;"><a href="${web}" style="color:#C9A961;">${web}</a></td></tr>` : ''}
            </table>
            <div style="margin-top:24px;padding:20px;background:rgba(255,255,255,0.04);border-radius:8px;border-left:3px solid #C9A961;">
              <div style="font-size:12px;color:#94a3b8;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.1em;">Zpráva</div>
              <div style="font-size:15px;color:#e2e8f0;line-height:1.7;">${zprava.replace(/\n/g, '<br>')}</div>
            </div>
          </div>
        </div>
      `,
    })

    /* ── Potvrzení klientovi ── */
    await resend.emails.send({
      from: 'jede.online <info@jede.online>',
      to: email,
      subject: 'Poptávku jsme přijali — ozveme se do 24 hodin',
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;background:#050508;color:#e2e8f0;border-radius:12px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#C9A961,#a8863d);padding:24px 32px;">
            <div style="font-size:20px;font-weight:700;color:#050508;letter-spacing:-0.02em;">
              jede<span style="opacity:0.6">.</span>online
            </div>
          </div>
          <div style="padding:32px;">
            <h1 style="font-size:22px;font-weight:600;color:#f1f5f9;margin:0 0 16px;letter-spacing:-0.01em;">
              Ahoj ${jmeno}, poptávku jsme přijali.
            </h1>
            <p style="font-size:15px;color:#94a3b8;line-height:1.75;margin:0 0 24px;">
              Ozveme se vám zpět do 24 hodin a společně vymyslíme nejlepší řešení pro váš byznys. Neformálně a bez závazků.
            </p>
            <div style="padding:20px;background:rgba(201,169,97,0.07);border:1px solid rgba(201,169,97,0.2);border-radius:8px;font-size:14px;color:#94a3b8;line-height:1.65;">
              <strong style="color:#C9A961;">Vaše zpráva:</strong><br><br>
              ${zprava.replace(/\n/g, '<br>')}
            </div>
            <p style="margin-top:28px;font-size:13px;color:#475569;">
              Máte dotaz? Napište nám přímo na <a href="mailto:info@jede.online" style="color:#C9A961;">info@jede.online</a>
            </p>
          </div>
        </div>
      `,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[poptavka]', err)
    return NextResponse.json({ error: 'Interní chyba serveru.' }, { status: 500 })
  }
}
