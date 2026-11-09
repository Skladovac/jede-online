'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireOrgContext } from '@/lib/org'
import { isPushEndpoint, sendPush } from '@/lib/push'
import { pushEndpointSchema, pushSubscriptionSchema, reminderSchema, type ReminderInput } from '@/lib/validation'

type Vysledek = { ok?: string; error?: string }

/** Uloží odběr zařízení k přihlášenému účtu. Endpoint musí být skutečná push služba (SSRF). */
export async function savePushSubscription(sub: unknown): Promise<{ ok: boolean }> {
  const { user } = await requireOrgContext()
  const v = pushSubscriptionSchema.safeParse(sub)
  if (!v.success || !isPushEndpoint(v.data.endpoint)) return { ok: false }
  const { endpoint, keys: { p256dh, auth } } = v.data
  // Odběr patří zařízení: když se na něm přihlásí jiný účet, odběr přejde na něj (endpoint je v daném prohlížeči jedinečný).
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { userId: user.id, endpoint, p256dh, auth },
    update: { userId: user.id, p256dh, auth },
  })
  return { ok: true }
}

export async function removePushSubscription(endpoint: string): Promise<{ ok: boolean }> {
  const { user } = await requireOrgContext()
  if (!pushEndpointSchema.safeParse(endpoint).success) return { ok: false }
  // Jen vlastní odběr: smazání podle samotného endpointu by dovolilo odhlásit cizí zařízení.
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: user.id } })
  return { ok: true }
}

export async function setReminder(opts: ReminderInput): Promise<{ ok: boolean }> {
  const { user } = await requireOrgContext()
  const v = reminderSchema.safeParse(opts)
  if (!v.success) return { ok: false }
  await prisma.user.update({ where: { id: user.id }, data: { remindEnabled: v.data.enabled } })
  revalidatePath('/nastaveni')
  return { ok: true }
}

export async function sendTestPush(): Promise<Vysledek> {
  const { user } = await requireOrgContext()
  const r = await sendPush(user.id, { title: 'Docházka', body: 'Takhle bude vypadat večerní připomínka.', url: '/' })
  if (r.sent > 0) return { ok: 'Zkušební notifikace odeslána.' }
  if (r.skipped === 'no-keys') return { error: 'Notifikace nejsou na tomto serveru nastavené.' }
  if (r.skipped === 'no-devices') return { error: 'Žádné zařízení nemá zapnuté notifikace.' }
  return { error: 'Notifikaci se nepodařilo odeslat. Zkus zapnout notifikace znovu.' }
}
