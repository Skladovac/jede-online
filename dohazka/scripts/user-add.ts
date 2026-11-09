// Založí účet, nebo existujícímu přepíše heslo (náhrada „zapomenutého hesla“).
// Použití: npm run user:add -- --email a@b.cz --name "Jméno" --tracks-from 2026-11-01 [--period-start 16]
// Heslo se z argumentu nebere (zůstalo by v historii shellu) — vygeneruje se a vypíše jednou na konci.
import { randomBytes } from 'node:crypto'
import { parseArgs } from 'node:util'
import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../src/lib/crypto'
import { parseDayKey } from '../src/lib/date'
import { loginSchema } from '../src/lib/validation'

const ABECEDA = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789' // bez zaměnitelných znaků

function generujHeslo(delka = 16) {
  // Zahazujeme hodnoty nad násobkem délky abecedy, aby rozdělení znaků bylo rovnoměrné.
  const mez = 256 - (256 % ABECEDA.length)
  let heslo = ''
  while (heslo.length < delka) {
    for (const b of randomBytes(32)) {
      if (b < mez && heslo.length < delka) heslo += ABECEDA[b % ABECEDA.length]
    }
  }
  return heslo
}

async function main() {
  const { values } = parseArgs({
    options: { email: { type: 'string' }, name: { type: 'string' }, 'tracks-from': { type: 'string' }, 'period-start': { type: 'string' } },
  })
  const jmeno = values.name?.trim()
  const od = values['tracks-from']
  if (!values.email || !jmeno || !od || !/^\d{4}-\d{2}-\d{2}$/.test(od)) {
    throw new Error('Použití: npm run user:add -- --email a@b.cz --name "Jméno" --tracks-from 2026-11-01')
  }
  const tracksFrom = parseDayKey(od)
  // parseDayKey neplatné datum (2026-13-45) tiše přetočí, proto ověříme, že vyjde zpět to samé.
  if (Number.isNaN(tracksFrom.getTime()) || tracksFrom.toISOString().slice(0, 10) !== od) {
    throw new Error('--tracks-from není platné datum (RRRR-MM-DD).')
  }
  // Volitelné: den, kterým začíná výkazové období (1 = kalendářní měsíc, 16 = od 16. do 15.). 1–28, aby existoval v každém měsíci.
  let periodStartDay: number | undefined
  if (values['period-start'] !== undefined) {
    if (!/^\d{1,2}$/.test(values['period-start'])) throw new Error('--period-start musí být celé číslo 1–28.')
    periodStartDay = Number(values['period-start'])
    if (periodStartDay < 1 || periodStartDay > 28) throw new Error('--period-start musí být celé číslo 1–28.')
  }
  const email = loginSchema.shape.email.parse(values.email)

  const heslo = generujHeslo()
  const passwordHash = await hashPassword(heslo)
  const prisma = new PrismaClient()
  try {
    const existuje = await prisma.user.findUnique({ where: { email }, select: { id: true } })
    if (existuje) {
      await prisma.user.update({ where: { email }, data: { passwordHash, name: jmeno, tracksFrom, ...(periodStartDay !== undefined && { periodStartDay }) } })
      // Staré přihlášení přestane platit — po změně hesla se musí přihlásit znovu.
      await prisma.session.deleteMany({ where: { userId: existuje.id } })
      console.log(`Účet ${email} už existoval — přepsáno heslo (jméno a datum začátku nastaveny podle zadání).`)
    } else {
      await prisma.user.create({ data: { email, name: jmeno, tracksFrom, passwordHash, ...(periodStartDay !== undefined && { periodStartDay }) } })
      console.log(`Účet ${email} založen.`)
    }
  } finally {
    await prisma.$disconnect()
  }
  console.log(`Heslo (zobrazeno jen teď, uložte si ho): ${heslo}`)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : 'Neznámá chyba.')
  process.exit(1)
})
