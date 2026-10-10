'use client'

import { useActionState, useState } from 'react'
import { deleteProductItem, saveProductItem } from '@/app/actions/products'
import { Alert, inputCls } from '@/components/ui'
import { useT } from '@/lib/i18n/client'
import { PRODUCT_LANGS } from '@/lib/products'

export type ProductItemData = {
  id?: string
  language: string
  quantity: number
  spareQty: number
  offerType: string | null
  priceCzk: number | null
  note: string | null
  purchasePriceCzk?: number | null
}

const small = inputCls.replace('py-2.5', 'py-2') + ' text-sm'

export function ProductItemForm({ productId, item }: { productId: number; item: ProductItemData }) {
  const t = useT()
  const [state, action, pending] = useActionState(saveProductItem, undefined)
  const [delState, delAction] = useActionState(deleteProductItem, undefined)
  const [spare, setSpare] = useState(item.spareQty)
  const [offer, setOffer] = useState(item.offerType ?? 'SELL')

  return (
    <div className="rounded-panel border border-line bg-card p-4">
      <form action={action} className="space-y-3">
        <input type="hidden" name="productId" value={productId} />
        {item.id && <input type="hidden" name="id" value={item.id} />}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <label className="space-y-1 text-xs">
            <span className="text-subtle">{t('Jazyk')}</span>
            <select name="language" defaultValue={item.language} className={small}>
              {PRODUCT_LANGS.map(([v, l]) => (
                <option key={v} value={v}>
                  {t(l)}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-subtle">{t('Kusů celkem')}</span>
            <input name="quantity" type="number" min={1} max={999} defaultValue={item.quantity} className={small} />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-subtle">{t('Z toho navíc')}</span>
            <input
              name="spareQty"
              type="number"
              min={0}
              max={999}
              value={spare}
              onChange={(e) => setSpare(Number(e.target.value))}
              className={small}
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-subtle">{t('Poznámka (max 30)')}</span>
            <input name="note" maxLength={30} defaultValue={item.note ?? ''} className={small} />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-subtle">{t('Koupeno za (Kč/ks)')}</span>
            <input
              name="purchasePriceCzk"
              inputMode="numeric"
              defaultValue={item.purchasePriceCzk ?? ''}
              placeholder={t('nepovinné')}
              title={t('Vidíš jen ty — v přehledu ukáže investováno a zisk nebo ztrátu.')}
              className={small}
            />
          </label>
        </div>

        {spare > 0 && (
          <div className="flex flex-wrap items-end gap-2 rounded-xl bg-blue-50 p-3 dark:bg-blue-500/10">
            <label className="space-y-1 text-xs">
              <span className="text-subtle">{t('Kusy navíc')}</span>
              <select name="offerType" value={offer} onChange={(e) => setOffer(e.target.value)} className={small}>
                <option value="SELL">{t('prodám')}</option>
                <option value="TRADE">{t('vyměním')}</option>
                <option value="GIFT">{t('daruji za poštovné')}</option>
              </select>
            </label>
            {offer === 'SELL' && (
              <label className="space-y-1 text-xs">
                <span className="text-subtle">{t('Cena za kus (Kč)')}</span>
                <input name="priceCzk" type="number" min={1} defaultValue={item.priceCzk ?? ''} className={small} />
              </label>
            )}
          </div>
        )}

        <Alert state={state ?? delState} />
        <div className="flex items-center gap-3">
          <button
            disabled={pending}
            className="rounded-xl bg-accent-strong px-4 py-2 text-sm font-semibold text-on-accent disabled:opacity-50"
          >
            {item.id ? t('Uložit') : t('Přidat do sbírky')}
          </button>
          {item.id && (
            <button formAction={delAction} className="text-sm text-red-600 underline">
              {t('Odebrat')}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
