import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Resend } from 'resend'
import { getConfirmationEmail } from '@/lib/email'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  let body: { email?: string; source?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Neplatný požadavek.' }, { status: 400 })
  }

  const email = (body.email ?? '').trim().toLowerCase()
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Neplatná e-mailová adresa.' }, { status: 400 })
  }

  try {
    await prisma.lead.upsert({
      where: { email },
      update: {},
      create: { email, source: body.source ?? 'hero' },
    })

    await resend.emails.send({
      from: 'jede.online <info@jede.online>',
      to: email,
      subject: 'Váš dotaz byl přijat — jede.online',
      html: getConfirmationEmail(email),
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[register]', err)
    return NextResponse.json({ error: 'Chyba serveru. Zkuste to prosím znovu.' }, { status: 500 })
  }
}
