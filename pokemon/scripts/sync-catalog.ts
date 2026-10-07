// Ruční import katalogu (lokálně nebo pro test): npx tsx scripts/sync-catalog.ts [sv01 base1 …]
// Bez argumentů stáhne všechny sady. Potřebuje DATABASE_URL v prostředí.
import { syncCatalog } from '../src/lib/catalog-sync'

syncCatalog(console.log, process.argv.length > 2 ? process.argv.slice(2) : undefined).then((s) => {
  console.log(JSON.stringify(s))
  process.exit(0)
})
