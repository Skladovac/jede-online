'use server'

import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { consumeInvitation, inviteByMail } from '@/lib/invitation'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { loginSchema } from '@/lib/validation'

// Tenhle soubor smí exportovat jen serverové akce: každý export je volatelný z prohlížeče.

export async function setPassword(token: string, formData: FormData): Promise<{ error: string }> {
  if (!rateLimit('pozvanka:' + (await clientIp()), 10, 15 * 60_000)) return { error: 'Příliš mnoho pokusů. Zkuste to za chvíli.' }
  const heslo = String(formData.get('password') ?? '')
  if (heslo !== String(formData.get('password2') ?? '')) return { error: 'Hesla se neshodují.' }
  const r = await consumeInvitation(String(token), heslo)
  if ('error' in r) return r
  redirect('/prihlaseni?heslo=nastaveno')
}

// Stejná odpověď pro známý i neznámý e-mail (nesmí se z ní dát poznat, jestli účet existuje).
const ODPOVED = 'Pokud je tento e-mail v systému, poslali jsme na něj odkaz pro nastavení nového hesla.'

/**
 * Žádost o obnovu hesla. Není to orákulum účtů:
 * - odpověď je pro známý i neznámý e-mail stejná, včetně času: v odpovědi je jen jeden dotaz do databáze
 *   (stejný v obou případech); vytvoření odkazu a odeslání e-mailu běží na pozadí a odpověď na ně nečeká;
 * - limity (IP a e-mail) se řídí jen vstupem, ne existencí účtu.
 */
export async function requestPasswordReset(formData: FormData): Promise<{ error: string } | { ok: true; message: string }> {
  const parsed = loginSchema.shape.email.safeParse(formData.get('email'))
  const email = parsed.success ? parsed.data : String(formData.get('email') ?? '').trim().toLowerCase().slice(0, 254)
  const smi = rateLimit('reset-ip:' + (await clientIp()), 10, 15 * 60_000) && rateLimit('reset-email:' + email, 3, 60 * 60_000)
  if (!smi) return { error: 'Příliš mnoho pokusů. Zkuste to za chvíli.' }
  if (!parsed.success) return { error: 'Zadej platný e-mail.' }

  const user = await prisma.user.findUnique({ where: { email: parsed.data }, select: { id: true } })
  if (user) {
    // Záměrně bez await: čas odpovědi nesmí prozradit, že se vytvářel odkaz a odesílal e-mail.
    void inviteByMail({ userId: user.id, kind: 'reset' }).catch((e) =>
      console.error('requestPasswordReset: odkaz se nepodařilo vytvořit', e instanceof Error ? e.name : 'chyba'),
    )
  }
  return { ok: true, message: ODPOVED }
}
