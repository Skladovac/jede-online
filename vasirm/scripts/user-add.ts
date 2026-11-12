// Přidání makléře nebo nové heslo pro existujícího (zapomenuté heslo).
//   npm run user:add -- <e-mail> "<Jméno Příjmení>"     → založí účet
//   npm run user:add -- <e-mail> --reset                → vygeneruje nové heslo
// Heslo se nevypisuje — zapíše se do CREDENTIALS_FILE (výchozí .credentials.local), odkud ho správce předá.
import { randomBytes } from 'crypto'
import { appendFile } from 'fs/promises'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { slugify } from '../src/lib/format'

const prisma = new PrismaClient()
const FILE = process.env.CREDENTIALS_FILE ?? '.credentials.local'

async function main() {
  const [emailArg, second] = process.argv.slice(2)
  const email = emailArg?.trim().toLowerCase()
  if (!email || !second) throw new Error('Použití: npm run user:add -- <e-mail> "<Jméno>"  |  <e-mail> --reset')
  const password = randomBytes(12).toString('base64url')
  const passwordHash = await bcrypt.hash(password, 12)

  if (second === '--reset') {
    const user = await prisma.user.update({ where: { email }, data: { passwordHash } })
    await prisma.session.deleteMany({ where: { userId: user.id } })
    await appendFile(FILE, `${user.name}\t${email}\t${password}\n`, { mode: 0o600 })
    console.log(`Nové heslo pro ${email} je v ${FILE}. Všechna přihlášení byla zrušena.`)
    return
  }

  const name = second.trim()
  let slug = slugify(name.split(' ')[0]) || 'makler'
  for (let i = 2; await prisma.user.findUnique({ where: { slug } }); i++) slug = `${slugify(name.split(' ')[0])}-${i}`
  const count = await prisma.user.count()
  await prisma.user.create({ data: { email, name, slug, publicEmail: email, passwordHash, sort: count } })
  await appendFile(FILE, `${name}\t${email}\t${password}\n`, { mode: 0o600 })
  console.log(`Účet ${email} založen, heslo je v ${FILE}.`)
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
