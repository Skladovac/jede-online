'use server'

import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { createSession, destroySession, hashPassword, randomToken, verifyPassword } from '@/lib/auth'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { loginSchema } from '@/lib/validation'

// Jedna obecná věta pro všechna selhání — neprozrazuje, který údaj je špatně.
const CHYBA = 'Špatný e-mail nebo heslo.'

// Hash pro případ, že účet neexistuje: bcrypt pak běží stejně dlouho a čas odpovědi e-mail neprozradí.
// Počítá se hned při načtení modulu, aby první pokus po startu nebyl znatelně pomalejší.
const slepyHash = hashPassword(randomToken())

export async function login(formData: FormData): Promise<{ error: string }> {
  // Limit na IP i na účet. Klíč účtu je jen normalizovaný vstup (existenci účtu nezjišťujeme) a hláška je v obou
  // případech stejná, takže limit nemůže posloužit jako orákulum, jestli e-mail existuje.
  // Cena: kdo zná e-mail majitele, může mu přihlášení na 15 minut zablokovat — to je u jednoho uživatele přijatelné.
  const parsed = loginSchema.safeParse({ email: formData.get('email'), password: formData.get('password') })
  const email = parsed.success ? parsed.data.email : String(formData.get('email') ?? '').trim().toLowerCase().slice(0, 254)
  const smi =
    rateLimit('login:' + (await clientIp()), 10, 15 * 60_000) && rateLimit('login-ucet:' + email, 10, 15 * 60_000)
  if (!smi) return { error: 'Příliš mnoho pokusů. Zkuste to za chvíli.' }
  if (!parsed.success) return { error: CHYBA }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } })
  const ok = await verifyPassword(parsed.data.password, user?.passwordHash ?? (await slepyHash))
  if (!user || !ok) return { error: CHYBA }

  await createSession(user.id)
  redirect('/')
}

export async function logout(): Promise<never> {
  await destroySession()
  redirect('/prihlaseni')
}
