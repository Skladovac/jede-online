import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  // Délku shora omezujeme kvůli bcryptu a zneužití; minimum řeší jen to, že pole není prázdné.
  password: z.string().min(1).max(200),
})
export type LoginInput = z.infer<typeof loginSchema>

// Připomínka: osobní vypínač. Hodinu určuje firma (Organization.remindHour), ne člověk.
export const reminderSchema = z.object({
  enabled: z.boolean(),
}).strict() // zahozená hodina se má ozvat chybou, ne tiše projít
export type ReminderInput = z.infer<typeof reminderSchema>

// Odběr push z prohlížeče (PushSubscription.toJSON). Meze odpovídají sloupcům v databázi.
export const pushEndpointSchema = z.string().min(1).max(1000)
export const pushSubscriptionSchema = z.object({
  endpoint: pushEndpointSchema,
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
})

// Nová firma spolu s jejím prvním správcem (OWNER). Zakládá ji jen super admin.
const kratky = z.string().trim().min(1).max(120)
export const orgSchema = z.object({
  name: kratky,
  reportName: kratky,
  ownerEmail: loginSchema.shape.email,
  ownerName: kratky,
  // Výchozí 'password' drží dosavadní chování pro volající, kteří volbu neposílají.
  delivery: z.enum(['invite', 'password']).default('password'),
})
export type OrgInput = z.input<typeof orgSchema>

// Nové heslo (pozvánka, obnova). Horní mez kvůli bcryptu; stejná jako u přihlášení.
export const passwordSchema = z.string().min(10).max(200)

// Nový člověk ve firmě. E-mail se normalizuje stejně jako při přihlášení, aby šlo o tutéž osobu.
export const personSchema = z.object({
  email: loginSchema.shape.email,
  name: kratky,
  role: z.enum(['OWNER', 'ACCOUNTANT', 'EMPLOYEE']),
  delivery: z.enum(['invite', 'password']).default('invite'),
})
export type PersonInput = z.input<typeof personSchema>

// Nastavení firmy. Hodnoty se NEOPRAVUJÍ (žádný clamp): mimo rozsah se odmítnou, protože přetvářejí
// každý měsíční přehled a export celé firmy. První den období je 1–28 (29–31 by přeskočily krátké měsíce,
// 0 dává nesmyslný klíč dne "2026-10-00"). Žádná koerce: řetězec "5" ani 5.5 neprojde.
export const orgSettingsSchema = z.object({
  reportName: kratky,
  periodStartDay: z.number().int().min(1).max(28),
  remindHour: z.number().int().min(0).max(23),
})
export type OrgSettingsInput = z.input<typeof orgSettingsSchema>
