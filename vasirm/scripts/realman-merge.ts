// Jednorázové spárování ručně zadané nemovitosti s její verzí z Realmanu (po prvním exportu).
// Realmanové verzi předá starou WordPress adresu (legacySlug → 301 z vasirm.cz/nemovitost/…), adresu stránky
// a zvýraznění; ručně zadanou nemovitost včetně fotek pak smaže.
//   npx tsx --conditions=react-server scripts/realman-merge.ts <slug ručně zadané> <ID zakázky v Realmanu>
// Bez --yes jen vypíše, co by udělal.
import { PrismaClient } from '@prisma/client'
import { deleteListingMedia } from '../src/lib/media'

const prisma = new PrismaClient()

async function main() {
  const [manualSlug, externalId, flag] = process.argv.slice(2)
  if (!manualSlug || !externalId) throw new Error('Použití: realman-merge.ts <slug ručně zadané> <ID zakázky v Realmanu> [--yes]')
  const manual = await prisma.listing.findUnique({ where: { slug: manualSlug } })
  const rm = await prisma.listing.findUnique({ where: { externalId } })
  if (!manual || manual.source !== 'MANUAL') throw new Error(`Ručně zadaná nemovitost „${manualSlug}“ neexistuje.`)
  if (!rm) throw new Error(`Zakázka ${externalId} z Realmanu na webu není — nejdřív ji v Realmanu exportujte.`)

  console.log(`Ruční:   ${manual.title} (${manual.slug})`)
  console.log(`Realman: ${rm.title} (${rm.slug}, zakázka ${externalId})`)
  if (flag !== '--yes') {
    console.log('Nic se nezměnilo. Pro provedení přidejte --yes.')
    return
  }
  await prisma.$transaction([
    prisma.lead.updateMany({ where: { listingId: manual.id }, data: { listingId: rm.id } }),
    prisma.listing.delete({ where: { id: manual.id } }),
    prisma.listing.update({
      where: { id: rm.id },
      data: { slug: manual.slug, legacySlug: manual.legacySlug, featured: manual.featured || rm.featured, publishedAt: manual.publishedAt ?? rm.publishedAt },
    }),
  ])
  await deleteListingMedia(manual.id)
  console.log(`Hotovo: zakázka ${externalId} má adresu /nabidka/${manual.slug}${manual.legacySlug ? ' i přesměrování ze starého webu' : ''}.`)
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
