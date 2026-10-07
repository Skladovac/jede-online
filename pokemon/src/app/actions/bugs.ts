'use server'

import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { ADMIN_EMAIL, esc, notify } from '@/lib/email'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { EMAIL_RE, str, type FormState } from '@/lib/validation'

/** Hlášení chyby z patičky. Může poslat kdokoli; proti spamu limit a skryté pole pro roboty. */
export async function reportBug(_: FormState, fd: FormData): Promise<FormState> {
  if (str(fd, 'website')) return { ok: 'Díky!' } // skryté pole vyplní jen robot
  if (!rateLimit(`bug:${await clientIp()}`, 5, 60 * 60_000)) return { error: 'Příliš mnoho hlášení, zkus to za hodinu.' }

  const message = str(fd, 'message')
  const contact = str(fd, 'contact')
  // Adresu posílá prohlížeč — může být podvržená (např. "javascript:…"). Bereme jen http(s).
  const rawUrl = str(fd, 'pageUrl').slice(0, 500)
  const pageUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : ''
  if (message.length < 10) return { error: 'Popiš prosím chybu aspoň pár slovy (min. 10 znaků).' }
  if (message.length > 2000) return { error: 'Popis je moc dlouhý (max. 2000 znaků).' }
  if (contact && !EMAIL_RE.test(contact)) return { error: 'Kontaktní e-mail nevypadá správně (nebo ho nech prázdný).' }

  const user = await getCurrentUser()
  const bug = await prisma.bugReport.create({
    data: {
      message,
      pageUrl: pageUrl || null,
      userId: user?.id ?? null,
      contact: contact || null,
      userAgent: ((await headers()).get('user-agent') ?? '').slice(0, 300) || null,
    },
  })
  await notify(ADMIN_EMAIL, [], `Nahlášená chyba na pokemon.jede.online`, [
    `Od: ${user ? esc(user.nickname) : 'nepřihlášený'}${contact ? ` (${esc(contact)})` : ''}`,
    `Stránka: ${esc(pageUrl || '—')}`,
    esc(message).replace(/\n/g, '<br>'),
  ], { label: 'Otevřít v administraci', url: `https://pokemon.jede.online/admin/chyby#${bug.id}` })
  return { ok: 'Díky! Chybu jsme dostali a podíváme se na ni.' }
}
