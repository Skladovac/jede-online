// Založí účet, nebo existujícímu přepíše heslo (náhrada „zapomenutého hesla“), a podle zadání
// ho zařadí do firmy s rolí nebo mu nastaví příznak super admina.
// Použití:
//   nový účet:        npm run user:add -- --email a@b.cz --name "Jméno" [--org <id> --role EMPLOYEE --tracks-from 2026-11-01] [--super-admin]
//   nové heslo:       npm run user:add -- --email a@b.cz --name "Jméno"
//   jen role/příznak: npm run user:add -- --email a@b.cz --org <id> --role OWNER      (heslo se nemění)
//                     npm run user:add -- --email a@b.cz --super-admin                (první správce po migraci)
// Heslo se z argumentu nebere (zůstalo by v historii shellu) — vygeneruje se a vypíše jednou na konci.
// Heslo se mění jen při zadaném --name (nový účet, nebo vědomé přepsání); samotná role ani příznak ho nemění.
import { randomBytes } from 'node:crypto'
import { parseArgs } from 'node:util'
import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../src/lib/crypto'
import { parseDayKey } from '../src/lib/date'
import { ROLES, type RoleValue } from '../src/lib/role'
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
    options: {
      email: { type: 'string' },
      name: { type: 'string' },
      'tracks-from': { type: 'string' },
      org: { type: 'string' },
      role: { type: 'string' },
      'super-admin': { type: 'boolean' },
    },
  })
  if (!values.email) throw new Error('Chybí --email.')
  const email = loginSchema.shape.email.parse(values.email)
  const jmeno = values.name?.trim() || undefined

  // Role se ověřuje proti třem hodnotám dřív, než se sáhne na databázi: `can()` na cokoli jiného vyhazuje.
  if ((values.org === undefined) !== (values.role === undefined)) throw new Error('--org a --role se zadávají spolu.')
  let role: RoleValue | undefined
  if (values.role !== undefined) {
    if (!(ROLES as readonly string[]).includes(values.role)) throw new Error(`--role musí být jedna z: ${ROLES.join(', ')}.`)
    role = values.role as RoleValue
  }

  let tracksFrom: Date | undefined
  const od = values['tracks-from']
  if (od !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(od)) throw new Error('--tracks-from není platné datum (RRRR-MM-DD).')
    tracksFrom = parseDayKey(od)
    // parseDayKey neplatné datum (2026-13-45) tiše přetočí, proto ověříme, že vyjde zpět to samé.
    if (Number.isNaN(tracksFrom.getTime()) || tracksFrom.toISOString().slice(0, 10) !== od) {
      throw new Error('--tracks-from není platné datum (RRRR-MM-DD).')
    }
  }

  const prisma = new PrismaClient()
  try {
    const org = values.org ? await prisma.organization.findUnique({ where: { id: values.org }, select: { id: true, name: true } }) : null
    if (values.org && !org) throw new Error(`Firma ${values.org} neexistuje.`)

    const existuje = await prisma.user.findUnique({ where: { email }, select: { id: true } })
    if (!existuje && !jmeno) throw new Error('Nový účet potřebuje --name.')
    if (org && !tracksFrom) {
      const maClenstvi = existuje
        ? await prisma.membership.findUnique({ where: { userId_orgId: { userId: existuje.id, orgId: org.id } }, select: { id: true } })
        : null
      if (!maClenstvi) throw new Error('Nové členství potřebuje --tracks-from (RRRR-MM-DD).')
    }
    if (!jmeno && !org && !values['super-admin']) throw new Error('Není co udělat: zadej --name, --org s --role, nebo --super-admin.')

    // Heslo se mění jen s --name; samotná role nebo příznak účtu heslo ani přihlášení nesmí rozbít.
    const heslo = jmeno ? generujHeslo() : undefined
    const passwordHash = heslo ? await hashPassword(heslo) : undefined
    const priznak = values['super-admin'] ? { isSuperAdmin: true } : {}

    let userId: string
    if (existuje) {
      userId = existuje.id
      await prisma.user.update({ where: { email }, data: { ...(jmeno && { name: jmeno }), ...(passwordHash && { passwordHash }), ...priznak } })
      if (passwordHash) {
        // Staré přihlášení přestane platit — po změně hesla se musí přihlásit znovu.
        await prisma.session.deleteMany({ where: { userId } })
        console.log(`Účet ${email} už existoval — přepsáno heslo a jméno.`)
      } else {
        console.log(`Účet ${email} už existoval — heslo beze změny.`)
      }
    } else {
      const u = await prisma.user.create({ data: { email, name: jmeno!, passwordHash: passwordHash!, ...priznak } })
      userId = u.id
      console.log(`Účet ${email} založen.`)
    }
    if (values['super-admin']) console.log(`${email}: nastaven super admin.`)

    if (org && role) {
      // Členství se zakládá znovu aktivní: tímhle se dá vrátit i deaktivovaný člověk.
      await prisma.membership.upsert({
        where: { userId_orgId: { userId, orgId: org.id } },
        create: { userId, orgId: org.id, role, active: true, tracksFrom: tracksFrom! },
        update: { role, active: true, ...(tracksFrom && { tracksFrom }) },
      })
      console.log(`${email}: ve firmě ${org.name} jako ${role}.`)
    }
    if (heslo) console.log(`Heslo (zobrazeno jen teď, uložte si ho): ${heslo}`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : 'Neznámá chyba.')
  process.exit(1)
})
