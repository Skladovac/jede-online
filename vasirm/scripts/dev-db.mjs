// Lokální Postgres pro vývoj (bez Dockeru): npm run db:local
// Data jsou ve složce .pg-data (v .gitignore). Ukončení: Ctrl+C.
import EmbeddedPostgres from 'embedded-postgres'
import { existsSync } from 'fs'
import path from 'path'

const dir = path.resolve('.pg-data')
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  user: 'vasirm',
  password: 'vasirm',
  port: 5433,
  persistent: true,
  // Bez toho by Windows založil databázi v kódování WIN1250 (neumí třeba „m²“).
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
})

if (!existsSync(path.join(dir, 'PG_VERSION'))) await pg.initialise()
await pg.start()
try {
  await pg.createDatabase('vasirm')
} catch {
  // už existuje
}
console.log('Postgres běží na localhost:5433 (databáze vasirm). Ctrl+C ukončí.')

const stop = async () => {
  await pg.stop()
  process.exit(0)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
setInterval(() => {}, 1 << 30)
