import 'server-only'
import { prisma } from '@/lib/prisma'
import { sendPush } from '@/lib/push'
import { dateColumnToKey, parseDayKey, pragueDayKey, pragueHour } from '@/lib/date'

/** Připomínka platí od nastavené hodiny po dvě hodiny, nikdy přes půlnoc (ve dvě ráno telefon nepípá). */
export function shouldRemind(args: {
  nowHour: number
  todayKey: string
  settings: { remindEnabled: boolean; remindHour: number; tracksFromKey: string }
  hasEntryToday: boolean
  alreadyRemindedToday: boolean
}): boolean {
  const { nowHour, todayKey, settings, hasEntryToday, alreadyRemindedToday } = args
  if (!settings.remindEnabled || hasEntryToday || alreadyRemindedToday) return false
  // Klíče dnů jsou YYYY-MM-DD, takže porovnání řetězců je porovnáním dat.
  if (todayKey < settings.tracksFromKey) return false
  return nowHour >= settings.remindHour && nowHour <= settings.remindHour + 2
}

/**
 * Projde aktivní členství lidí s aspoň jedním zařízením a pošle večerní připomínku těm, kdo mají zapsat.
 * Hodina připomínky je nastavení firmy (členství → organizace), ne člověka.
 * Spouští ho systemd timer každou hodinu; "dnes" i "kolik je hodin" je pražský čas.
 * Připomíná se každý den, i o víkendech a svátcích — kamarád pracuje nepravidelně.
 * Klíč ReminderLog zůstává (userId, den): kdo patří do více firem, dostane za den nejvýš jednu
 * připomínku a vyhrává první členství, které je na řadě.
 */
export async function runReminder(opts: { now?: Date; force?: boolean } = {}): Promise<{ checked: number; sent: number }> {
  const now = opts.now ?? new Date()
  const todayKey = pragueDayKey(now)
  const realHour = pragueHour(now)
  const day = parseDayKey(todayKey)

  const memberships = await prisma.membership.findMany({
    // Deaktivované členství nepřipomíná nikdy.
    where: { active: true, user: { pushSubscriptions: { some: {} } } },
    select: {
      id: true,
      tracksFrom: true,
      user: { select: { id: true, remindEnabled: true } },
      org: { select: { remindHour: true, name: true } },
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  })

  let sent = 0
  // Uživatelé, kterým se už v tomto běhu připomínka řešila (při force se do logu nezapisuje, tohle drží „nejvýš jedna“).
  const vyrizeni = new Set<string>()
  for (const m of memberships) {
    const u = m.user
    if (vyrizeni.has(u.id)) continue
    // Jakýkoli záznam dne (i "Nepracoval") znamená, že člen už odpověděl.
    const hasEntryToday = (await prisma.entry.findFirst({ where: { membershipId: m.id, day }, select: { id: true } })) !== null
    const alreadyRemindedToday =
      (await prisma.reminderLog.findUnique({ where: { userId_day: { userId: u.id, day } }, select: { id: true } })) !== null

    const due = shouldRemind({
      // force = ruční test mimo čas: chová se, jako by bylo právě hodina této firmy
      nowHour: opts.force ? m.org.remindHour : realHour,
      todayKey,
      settings: { remindEnabled: u.remindEnabled, remindHour: m.org.remindHour, tracksFromKey: dateColumnToKey(m.tracksFrom) },
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
    vyrizeni.add(u.id)

    const r = await sendPush(u.id, { title: 'Zapiš si dnešní hodiny', body: `${m.org.name}: ať na to večer nezapomeneš.`, url: `/den/${todayKey}` })
    if (r.sent > 0) {
      sent++
    } else if (!opts.force) {
      // Nic nedorazilo (výpadek push služby, mrtvé odběry) — uvolnit den, ať to příští hodinový běh zkusí znovu.
      await prisma.reminderLog.delete({ where: { userId_day: { userId: u.id, day } } }).catch(() => {})
    }
  }
  return { checked: memberships.length, sent }
}
