// Importuj jen na serveru (nebo přes '@/lib/auth'): bcryptjs by jinak skončil v balíčku pro prohlížeč.
// Čisté kryptografické funkce. Záměrně bez 'server-only', aby šly testovat ve vitestu.
import { createHash, randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'

export const randomToken = () => randomBytes(32).toString('base64url')
export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

export const hashPassword = (pw: string) => bcrypt.hash(pw, 12)
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash)

const ABECEDA = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789' // bez zaměnitelných znaků

/** Náhodné heslo bez zaměnitelných znaků (stejná abeceda jako `npm run user:add`). */
export function generatePassword(length = 16): string {
  // Zahazujeme hodnoty nad násobkem délky abecedy, aby rozdělení znaků bylo rovnoměrné.
  const limit = 256 - (256 % ABECEDA.length)
  let out = ''
  while (out.length < length) {
    for (const b of randomBytes(32)) {
      if (b < limit && out.length < length) out += ABECEDA[b % ABECEDA.length]
    }
  }
  return out
}
