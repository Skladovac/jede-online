import 'server-only'
import { prisma } from '@/lib/prisma'
import { sendPush } from '@/lib/push'

/** Upozornění na webu (zvoneček) + push na telefon. Chyba při zápisu nesmí shodit akci, která ho vyvolala. */
export async function pushNotification(userId: string, n: { title: string; body?: string; url?: string; icon?: string }) {
  // Push běží na pozadí — akce na odeslání nečeká.
  void sendPush(userId, n).catch((err) => console.error('[push]', err))
  await prisma.notification
    .create({
      data: {
        userId,
        title: n.title.slice(0, 200),
        body: n.body?.slice(0, 500) ?? null,
        url: n.url?.slice(0, 300) ?? null,
        icon: n.icon ?? null,
      },
    })
    .catch((err) => console.error('[upozorneni]', err))
}

/** Jazyk příjemce (pro překlad upozornění v době vytvoření). */
export async function localeOf(userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { locale: true } })
  return u?.locale ?? 'cs'
}
