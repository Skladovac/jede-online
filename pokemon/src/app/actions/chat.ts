'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { APP_URL, esc, notify } from '@/lib/email'
import { rateLimit } from '@/lib/rate-limit'
import { pushNotification } from '@/lib/notifications'
import { textProblem } from '@/lib/nickname-filter'
import { str, type FormState } from '@/lib/validation'
import { getT, tFor } from '@/lib/i18n/server'

/**
 * Zpráva k výměně. Psát jde jen u přijaté výměny (dřív ne — ochrana proti obtěžování).
 * Příjemce dostane upozornění do zvonečku a e-mail, ale e-mail jen u první nepřečtené zprávy (ne za každou).
 * U nezletilých jde kopie e-mailu rodiči (stejně jako u žádostí o výměnu).
 */
export async function sendTradeMessage(_: FormState, fd: FormData): Promise<FormState> {
  const t = await getT()
  const user = await getCurrentUser()
  if (!user) return { error: t('Nejdřív se přihlas.') }
  const req = await prisma.tradeRequest.findUnique({ where: { id: str(fd, 'requestId') }, include: { from: true, to: true } })
  if (!req || (req.fromId !== user.id && req.toId !== user.id)) return { error: t('Výměna nenalezena.') }
  if (req.status !== 'ACCEPTED') return { error: t('Psát si můžete, dokud je výměna přijatá a nedokončená.') }
  const other = req.fromId === user.id ? req.to : req.from
  if (other.bannedAt || user.bannedAt) return { error: t('Zprávu teď poslat nejde.') }

  const body = str(fd, 'body').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  if (!body) return { error: t('Napiš zprávu.') }
  if (body.length > 1000) return { error: t('Zpráva může mít nejvýš 1000 znaků.') }
  if (await textProblem(body)) return { error: t('Zpráva obsahuje nevhodné slovo. Uprav ji prosím.') }
  if (!rateLimit(`chat:${user.id}`, 40, 3_600_000)) return { error: t('Posíláš moc zpráv za sebou. Zkus to za chvíli.') }

  // Měl už příjemce nepřečtenou zprávu z této výměny? Pak už e-mail podruhé neposíláme.
  const pendingUnread = await prisma.tradeMessage.count({ where: { requestId: req.id, fromId: user.id, readAt: null } })
  await prisma.tradeMessage.create({ data: { requestId: req.id, fromId: user.id, body } })

  const tt = tFor(other.locale)
  const url = `/poptavky/${req.id}#chat`
  await pushNotification(other.id, {
    icon: '💬',
    title: tt('{name} ti napsal(a) k výměně', { name: user.nickname }),
    body: body.slice(0, 140),
    url,
  })
  if (!pendingUnread) {
    await notify(
      other.email,
      other.isMinor && other.parentEmail ? [other.parentEmail] : [],
      tt('Nová zpráva od {name} k výměně', { name: user.nickname }),
      [
        tt('<strong>{name}</strong> ti napsal(a) k vaší výměně na pokemon.jede.online:', { name: esc(user.nickname) }),
        `„${esc(body.slice(0, 500))}${body.length > 500 ? '…' : ''}“`,
        tt('Další zprávy ti e-mailem nepošleme, dokud tuhle nepřečteš.'),
      ],
      { label: tt('Odpovědět'), url: `${APP_URL}${url}` },
      other.locale,
    ).catch((err) => console.error('[chat-email]', err))
  }
  revalidatePath(`/poptavky/${req.id}`)
  return { ok: '' }
}
