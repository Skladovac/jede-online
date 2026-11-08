// Čisté kryptografické funkce. Záměrně bez 'server-only', aby šly testovat ve vitestu.
import { createHash, randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'

export const randomToken = () => randomBytes(32).toString('base64url')
export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

export const hashPassword = (pw: string) => bcrypt.hash(pw, 12)
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash)
