// Založí účet, nebo existujícímu upraví jméno, heslo, členství ve firmě a příznak super admina.
// Použití:
//   nový účet:        npm run user:add -- --email a@b.cz --name "Jméno" --org <id> --role EMPLOYEE --tracks-from 2026-11-01
//   první správce:    npm run user:add -- --email a@b.cz --name "Jméno" --super-admin     (nový účet bez firmy musí být super admin)
//   nové heslo:       npm run user:add -- --email a@b.cz --reset-password
//   přejmenování:     npm run user:add -- --email a@b.cz --name "Nové jméno"
//   změna role:       npm run user:add -- --email a@b.cz --org <id> --role OWNER          (aktivitu členství NEMĚNÍ)
//   vrátit / odebrat: ... --org <id> --role OWNER --activate    |    ... --org <id> --role OWNER --deactivate
//   příznak:          npm run user:add -- --email a@b.cz --super-admin                    (existujícímu účtu; po migraci první správce)
// Heslo se z argumentu nebere (zůstalo by v historii shellu) — vygeneruje se a vypíše jednou, a to hned po zápisu účtu.
// Heslo se mění jen u nového účtu a s --reset-password; --name samotné ho nemění.
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
      'reset-password': { type: 'boolean' },
      activate: { type: 'boolean' },
      deactivate: { type: 'boolean' },
    },
  })
  if (!values.email) throw new Error('Chybí --email.')
  const email = loginSchema.shape.email.parse(values.email)
  const jmeno = values.name?.trim() || undefined
  if (values.name !== undefined && !jmeno) throw new Error('--name nesmí být prázdné.')

  // Prázdný řetězec není „nezadáno“: tichým zahozením by účet zůstal bez firmy.
  if (values.org !== undefined && !values.org.trim()) throw new Error('--org nesmí být prázdné.')
  if (values.role !== undefined && !values.role.trim()) throw new Error('--role nesmí být prázdné.')
  if ((values.org === undefined) !== (values.role === undefined)) throw new Error('--org a --role se zadávají spolu.')
  if (values.activate && values.deactivate) throw new Error('--activate a --deactivate nejdou dohromady.')
  if ((values.activate || values.deactivate) && values.org === undefined) throw new Error('--activate / --deactivate patří k --org a --role.')
  // Role se ověřuje proti třem hodnotám dřív, než se sáhne na databázi: `can()` na cokoli jiného vyhazuje.
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
    if (!existuje) {
      if (!jmeno) throw new Error('Nový účet potřebuje --name.')
      // Účet bez firmy a bez super admina by skončil navždy na /bez-pristupu.
      if (!org && !values['super-admin']) throw new Error('Nový účet potřebuje --org s --role, nebo --super-admin.')
    }
    const clenstvi = org && existuje
      ? await prisma.membership.findUnique({ where: { userId_orgId: { userId: existuje.id, orgId: org.id } }, select: { id: true, active: true, role: true } })
      : null
    if (org && !clenstvi && !tracksFrom) throw new Error('Nové členství potřebuje --tracks-from (RRRR-MM-DD).')
    if (org && !clenstvi && values.deactivate) throw new Error('--deactivate: členství ve firmě neexistuje.')
    if (!existuje && values['reset-password']) throw new Error('--reset-password patří k existujícímu účtu (nový dostane heslo sám).')
    if (existuje && !jmeno && !org && !values['super-admin'] && !values['reset-password']) {
      throw new Error('Není co udělat: zadej --name, --reset-password, --org s --role, nebo --super-admin.')
    }

    const noveHeslo = !existuje || values['reset-password'] === true
    const heslo = noveHeslo ? generujHeslo() : undefined
    const passwordHash = heslo ? await hashPassword(heslo) : undefined
    const priznak = values['super-admin'] ? { isSuperAdmin: true } : {}

    let userId: string
    if (existuje) {
      userId = existuje.id
      await prisma.user.update({ where: { email }, data: { ...(jmeno && { name: jmeno }), ...(passwordHash && { passwordHash }), ...priznak } })
      if (passwordHash) {
        // Staré přihlášení přestane platit — po změně hesla se musí přihlásit znovu.
        await prisma.session.deleteMany({ where: { userId } })
        console.log(`Účet ${email} už existoval — přepsáno heslo.`)
      } else {
        console.log(`Účet ${email} už existoval — heslo beze změny.`)
      }
      if (jmeno) console.log(`${email}: jméno nastaveno na „${jmeno}“.`)
    } else {
      const u = await prisma.user.create({ data: { email, name: jmeno!, passwordHash: passwordHash!, ...priznak } })
      userId = u.id
      console.log(`Účet ${email} založen.`)
    }
    // Heslo se vypíše hned po zápisu účtu: kdyby spadl zápis členství, člověk by jinak byl zamčený ven bez hesla.
    if (heslo) console.log(`Heslo (zobrazeno jen teď, uložte si ho): ${heslo}`)
    if (values['super-admin']) console.log(`${email}: nastaven super admin.`)

    if (org && role) {
      // `active` se mění jen výslovně: oprava role nesmí vrátit do hry někoho, komu byl přístup odebrán.
      const active = values.deactivate ? false : values.activate ? true : undefined
      await prisma.membership.upsert({
        where: { userId_orgId: { userId, orgId: org.id } },
        create: { userId, orgId: org.id, role, active: active ?? true, tracksFrom: tracksFrom! },
        update: { role, ...(active !== undefined && { active }), ...(tracksFrom && { tracksFrom }) },
      })
      console.log(`${email}: ve firmě ${org.name} jako ${role}.`)
      if (clenstvi && clenstvi.role !== role) console.log(`  role: ${clenstvi.role} -> ${role}`)
      if (clenstvi && active !== undefined && clenstvi.active !== active) {
        console.log(`  členství: ${clenstvi.active ? 'aktivní' : 'neaktivní'} -> ${active ? 'aktivní' : 'neaktivní'}`)
      }
      // Nezakazujeme to (je to operátorův nástroj), ale nesmí to projít potichu.
      if ((await prisma.membership.count({ where: { orgId: org.id, role: 'OWNER', active: true } })) === 0) {
        console.warn(`!! POZOR: firma ${org.name} (${org.id}) nemá žádného aktivního správce (OWNER). Nikdo v ní teď nemůže spravovat lidi.`)
      }
      if (clenstvi && !clenstvi.active && active === undefined) console.log('  členství zůstává NEAKTIVNÍ (k návratu použij --activate).')
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : 'Neznámá chyba.')
  process.exit(1)
})
