'use server'

import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { createSession, destroySession, hashPassword, randomToken, verifyPassword } from '@/lib/auth'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { loginSchema } from '@/lib/validation'

// Jedna obecná věta pro všechna selhání — neprozrazuje, který údaj je špatně.
const CHYBA = 'Špatný e-mail nebo heslo.'

// Hash pro případ, že účet neexistuje: bcrypt pak běží stejně dlouho a čas odpovědi e-mail neprozradí.
let slepyHash: Promise<string> | undefined
const getSlepyHash = () => (slepyHash ??= hashPassword(randomToken()))

export async function login(formData: FormData): Promise<{ error: string }> {
  if (!rateLimit('login:' + (await clientIp()), 10, 15 * 60_000)) {
    return { error: 'Příliš mnoho pokusů. Zkuste to za chvíli.' }
  }
  const parsed = loginSchema.safeParse({ email: formData.get('email'), password: formData.get('password') })
  if (!parsed.success) return { error: CHYBA }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } })
  const ok = await verifyPassword(parsed.data.password, user?.passwordHash ?? (await getSlepyHash()))
  if (!user || !ok) return { error: CHYBA }

  await createSession(user.id)
  redirect('/')
}

export async function logout(): Promise<never> {
  await destroySession()
  redirect('/prihlaseni')
}
