'use client'

import { useActionState, useState } from 'react'
import { deleteProductItem, saveProductItem } from '@/app/actions/products'
import { Alert, inputCls } from '@/components/ui'
import { PRODUCT_LANGS } from '@/lib/products'

export type ProductItemData = {
  id?: string
  language: string
  quantity: number
  spareQty: number
  offerType: string | null
  priceCzk: number | null
  note: string | null
}

const small = inputCls.replace('py-2.5', 'py-2') + ' text-sm'

export function ProductItemForm({ productId, item }: { productId: number; item: ProductItemData }) {
  const [state, action, pending] = useActionState(saveProductItem, undefined)
  const [delState, delAction] = useActionState(deleteProductItem, undefined)
  const [spare, setSpare] = useState(item.spareQty)
  const [offer, setOffer] = useState(item.offerType ?? 'SELL')

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <form action={action} className="space-y-3">
        <input type="hidden" name="productId" value={productId} />
        {item.id && <input type="hidden" name="id" value={item.id} />}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <label className="space-y-1 text-xs">
            <span className="text-slate-500">Jazyk</span>
            <select name="language" defaultValue={item.language} className={small}>
              {PRODUCT_LANGS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-slate-500">Kusů celkem</span>
            <input name="quantity" type="number" min={1} max={999} defaultValue={item.quantity} className={small} />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-slate-500">Z toho navíc</span>
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
            <span className="text-slate-500">Poznámka (max 30)</span>
            <input name="note" maxLength={30} defaultValue={item.note ?? ''} className={small} />
          </label>
        </div>

        {spare > 0 && (
          <div className="flex flex-wrap items-end gap-2 rounded-xl bg-blue-50 p-3 dark:bg-blue-500/10">
            <label className="space-y-1 text-xs">
              <span className="text-slate-500">Kusy navíc</span>
              <select name="offerType" value={offer} onChange={(e) => setOffer(e.target.value)} className={small}>
                <option value="SELL">prodám</option>
                <option value="TRADE">vyměním</option>
                <option value="GIFT">daruji za poštovné</option>
              </select>
            </label>
            {offer === 'SELL' && (
              <label className="space-y-1 text-xs">
                <span className="text-slate-500">Cena za kus (Kč)</span>
                <input name="priceCzk" type="number" min={1} defaultValue={item.priceCzk ?? ''} className={small} />
              </label>
            )}
          </div>
        )}

        <Alert state={state ?? delState} />
        <div className="flex items-center gap-3">
          <button
            disabled={pending}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-yellow-400 dark:text-slate-900"
          >
            {item.id ? 'Uložit' : 'Přidat do sbírky'}
          </button>
          {item.id && (
            <button formAction={delAction} className="text-sm text-red-600 underline">
              Odebrat
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
