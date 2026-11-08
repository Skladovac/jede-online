import 'server-only'
import { prisma } from '@/lib/prisma'
import { sendPush } from '@/lib/push'
import { parseDayKey, pragueDayKey, pragueHour } from '@/lib/date'

/** Připomínka platí od nastavené hodiny po dvě hodiny, nikdy přes půlnoc (ve dvě ráno telefon nepípá). */
export function shouldRemind(args: {
  nowHour: number
  todayKey: string
  user: { remindEnabled: boolean; remindHour: number; tracksFromKey: string }
  hasEntryToday: boolean
  alreadyRemindedToday: boolean
}): boolean {
  const { nowHour, todayKey, user, hasEntryToday, alreadyRemindedToday } = args
  if (!user.remindEnabled || hasEntryToday || alreadyRemindedToday) return false
  // Klíče dnů jsou YYYY-MM-DD, takže porovnání řetězců je porovnáním dat.
  if (todayKey < user.tracksFromKey) return false
  return nowHour >= user.remindHour && nowHour <= user.remindHour + 2
}

/**
 * Projde uživatele s aspoň jedním zařízením a pošle večerní připomínku těm, kdo mají zapsat.
 * Spouští ho systemd timer každou hodinu; "dnes" i "kolik je hodin" je pražský čas.
 * Připomíná se každý den, i o víkendech a svátcích — kamarád pracuje nepravidelně.
 */
export async function runReminder(opts: { now?: Date; force?: boolean } = {}): Promise<{ checked: number; sent: number }> {
  const now = opts.now ?? new Date()
  const todayKey = pragueDayKey(now)
  const realHour = pragueHour(now)
  const day = parseDayKey(todayKey)

  const users = await prisma.user.findMany({
    where: { pushSubscriptions: { some: {} } },
    select: { id: true, remindEnabled: true, remindHour: true, tracksFrom: true },
  })

  let sent = 0
  for (const u of users) {
    // Jakýkoli záznam dne (i "Nepracoval") znamená, že uživatel už odpověděl.
    const hasEntryToday = (await prisma.entry.findFirst({ where: { userId: u.id, day }, select: { id: true } })) !== null
    const alreadyRemindedToday =
      (await prisma.reminderLog.findUnique({ where: { userId_day: { userId: u.id, day } }, select: { id: true } })) !== null

    const due = shouldRemind({
      // force = ruční test mimo čas: chová se, jako by bylo právě uživatelova hodina
      nowHour: opts.force ? u.remindHour : realHour,
      todayKey,
      user: { remindEnabled: u.remindEnabled, remindHour: u.remindHour, tracksFromKey: pragueDayKey(u.tracksFrom) },
      hasEntryToday,
      // force je zkouška, která nesmí zabrat skutečnou večerní připomínku
      alreadyRemindedToday: opts.force ? false : alreadyRemindedToday,
    })
    if (!due) continue

    // Nejdřív zapsat, pak poslat: unique [userId, day] zajistí, že dvě souběžná spuštění nepípnou dvakrát.
    // Při force se nezapisuje nic — zkouška nesmí zabrat skutečnou připomínku.
    if (!opts.force) {
      try {
        await prisma.reminderLog.create({ data: { userId: u.id, day } })
      } catch (e) {
        if ((e as { code?: string }).code === 'P2002') continue
        throw e
      }
    }

    const r = await sendPush(u.id, { title: 'Zapiš si dnešní hodiny', body: 'Ať na to večer nezapomeneš.', url: '/' })
    if (r.sent > 0) {
      sent++
    } else if (!opts.force) {
      // Nic nedorazilo (výpadek push služby, mrtvé odběry) — uvolnit den, ať to příští hodinový běh zkusí znovu.
      await prisma.reminderLog.delete({ where: { userId_day: { userId: u.id, day } } }).catch(() => {})
    }
  }
  return { checked: users.length, sent }
}
