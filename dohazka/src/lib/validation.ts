import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  // Délku shora omezujeme kvůli bcryptu a zneužití; minimum řeší jen to, že pole není prázdné.
  password: z.string().min(1).max(200),
})
export type LoginInput = z.infer<typeof loginSchema>

// Připomínka: hodina 0–23 v pražském čase. Žádné další podmínky (pípá se každý den).
export const reminderSchema = z.object({
  enabled: z.boolean(),
  hour: z.number().int().min(0).max(23),
})
export type ReminderInput = z.infer<typeof reminderSchema>

// Odběr push z prohlížeče (PushSubscription.toJSON). Meze odpovídají sloupcům v databázi.
export const pushEndpointSchema = z.string().min(1).max(1000)
export const pushSubscriptionSchema = z.object({
  endpoint: pushEndpointSchema,
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
})
