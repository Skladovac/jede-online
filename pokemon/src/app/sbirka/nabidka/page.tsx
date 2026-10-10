import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, isLimited } from '@/lib/auth'
import { BulkOffer, type BulkItem } from '@/components/BulkOffer'
import { byLocalId } from '@/lib/format'
import { getT } from '@/lib/i18n/server'

export async function generateMetadata() {
  const t = await getT()
  return { title: t('Hromadná nabídka'), robots: { index: false, follow: false } }
}
export const dynamic = 'force-dynamic'

/** Vyber víc karet ze sbírky a nabídni je najednou (vyměním / prodám / daruji). */
export default async function BulkOfferPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/prihlaseni?next=/sbirka/nabidka')
  const t = await getT()
  const rows = await prisma.collectionItem.findMany({
    where: { userId: user.id, quantity: { gt: 0 } },
    include: { card: { include: { set: { select: { id: true, name: true, code: true, officialCount: true, releaseDate: true } } } } },
  })
  rows.sort(
    (a, b) =>
      (b.card.set.releaseDate?.getTime() ?? 0) - (a.card.set.releaseDate?.getTime() ?? 0) ||
      a.card.set.name.localeCompare(b.card.set.name) ||
      byLocalId(a.card, b.card),
  )
  const items: BulkItem[] = rows.map((r) => ({
    id: r.id,
    cardName: r.card.name,
    number: `${r.card.set.code ? `${r.card.set.code} ` : ''}${r.card.localId}`,
    imageUrl: r.card.imageUrl,
    setId: r.card.set.id,
    setName: r.card.set.name,
    variant: r.variant,
    quantity: r.quantity,
    spareQty: r.spareQty,
    offerType: r.offerType,
    priceCzk: r.priceCzk,
  }))

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <Link href="/sbirka" className="text-sm text-subtle hover:underline">
        ← {t('Moje sbírka')}
      </Link>
      <h1 className="mt-3 text-3xl font-black tracking-tight">{t('Hromadná nabídka')}</h1>
      <p className="mb-6 mt-2 text-muted">
        {t('Klepni na karty, které chceš nabídnout, a dole nastav počet kusů navíc a typ nabídky. Uloží se všem vybraným najednou.')}
      </p>
      {isLimited(user) && <p className="mb-6 text-sm text-accent">{t('Dokud rodič nepotvrdí účet, tvoje nabídky ostatní neuvidí.')}</p>}
      {items.length ? (
        <BulkOffer items={items} />
      ) : (
        <p className="text-muted">
          {t('Sbírka je prázdná.')}{' '}
          <Link href="/sady" className="underline">
            {t('Vyber sadu')}
          </Link>{' '}
          {t('a odklikej karty, které máš.')}
        </p>
      )}
    </main>
  )
}
