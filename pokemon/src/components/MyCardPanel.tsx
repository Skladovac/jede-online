import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { toggleWantForm } from '@/app/actions/collection'
import { ActionForm } from '@/components/ActionForm'
import { Submit } from '@/components/ui'
import { ItemForm } from '@/components/ItemForm'
import { CardBuyForm } from '@/components/BuyForm'
import { getT } from '@/lib/i18n/server'
import { Plus, Star } from 'lucide-react'

type CardVariants = {
  id: string
  hasNormal: boolean
  hasHolo: boolean
  hasReverse: boolean
  hasFirstEd: boolean
  hasPokeball: boolean
  hasMasterball: boolean
}

/** "Moje sbírka" na detailu karty: kolik kusů mám, v jaké variantě a stavu, co nabízím. */
export async function MyCardPanel({ card }: { card: CardVariants }) {
  const t = await getT()
  const user = await getCurrentUser()
  if (!user) {
    return (
      <p className="mt-8 rounded-xl bg-accent-soft px-4 py-3 text-sm text-fg">
        <Link href="/prihlaseni" className="font-semibold underline">
          {t('Přihlas se')}
        </Link>{' '}
        {t('a přidej si kartu do sbírky nebo mezi chybějící.')}
      </p>
    )
  }

  const [items, want] = await Promise.all([
    prisma.collectionItem.findMany({ where: { userId: user.id, cardId: card.id }, orderBy: { createdAt: 'asc' } }),
    prisma.wantItem.findFirst({ where: { userId: user.id, cardId: card.id } }),
  ])
  const variants = [
    card.hasNormal && 'NORMAL',
    card.hasHolo && 'HOLO',
    card.hasReverse && 'REVERSE',
    card.hasFirstEd && 'FIRST_EDITION',
    card.hasPokeball && 'POKEBALL',
    card.hasMasterball && 'MASTERBALL',
  ].filter(Boolean) as string[]
  if (!variants.length) variants.push('NORMAL')

  return (
    <section className="mt-8 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-fg">{t('Moje sbírka')}</h2>
        {!items.length && (
          <ActionForm action={toggleWantForm} className="flex items-center gap-2">
            <input type="hidden" name="cardId" value={card.id} />
            <Submit variant={want ? 'primary' : 'ghost'}>
              {want ? (
                <>
                  <Star className="h-4 w-4" strokeWidth={1.75} fill="currentColor" aria-hidden />
                  {t('Na seznamu chybějících')}
                </>
              ) : (
                <>
                  <Star className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                  {t('Chybí mi')}
                </>
              )}
            </Submit>
          </ActionForm>
        )}
      </div>
      {/* „Chci koupit“: rozšíření chybějící karty (karta se tím přidá mezi chybějící). */}
      {!items.length && <CardBuyForm cardId={card.id} variants={variants} want={want} />}
      {items.map((i) => (
        <ItemForm key={i.id} cardId={card.id} variants={variants} item={i} />
      ))}
      <details className="group" open={!items.length}>
        <summary className="cursor-pointer text-sm font-semibold text-accent">
          {items.length ? (
            <span className="inline-flex items-center gap-1">
              <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
              {t('Přidat další kus (jiná varianta, stav nebo jazyk)')}
            </span>
          ) : (
            t('Přidat do sbírky')
          )}
        </summary>
        <div className="mt-3">
          <ItemForm
            cardId={card.id}
            variants={variants}
            item={{
              variant: variants[0],
              condition: 'MINT',
              language: 'en',
              quantity: 1,
              spareQty: 0,
              offerType: null,
              priceCzk: null,
              note: null,
            }}
          />
        </div>
      </details>
    </section>
  )
}
