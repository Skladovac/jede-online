'use client'

import { useActionState, useState } from 'react'
import { deleteItem, saveItem } from '@/app/actions/collection'
import { Alert, inputCls } from '@/components/ui'
import { useT } from '@/lib/i18n/client'

export type ItemData = {
  id?: string
  variant: string
  condition: string
  language: string
  quantity: number
  spareQty: number
  offerType: string | null
  priceCzk: number | null
  note: string | null
  purchasePriceCzk?: number | null
}

const VARIANT_LABEL: Record<string, string> = { NORMAL: 'Normální', HOLO: 'Holo', REVERSE: 'Reverse holo', FIRST_EDITION: '1st edition', POKEBALL: 'Poké Ball reverse', MASTERBALL: 'Master Ball reverse' }
const LANGS: [string, string][] = [
  ['en', 'angličtina'],
  ['de', 'němčina'],
  ['fr', 'francouzština'],
  ['it', 'italština'],
  ['es', 'španělština'],
  ['ja', 'japonština'],
  ['ko', 'korejština'],
  ['zh', 'čínština'],
  ['other', 'jiný'],
]
const small = inputCls.replace('py-2.5', 'py-2') + ' text-sm'

/** Jeden řádek sbírky (varianta + stav + jazyk) na detailu karty. */
export function ItemForm({ cardId, item, variants }: { cardId: string; item: ItemData; variants: string[] }) {
  const t = useT()
  const [state, action, pending] = useActionState(saveItem, undefined)
  const [delState, delAction] = useActionState(deleteItem, undefined)
  const [spare, setSpare] = useState(item.spareQty)
  const [offer, setOffer] = useState(item.offerType ?? 'TRADE')

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <form action={action} className="space-y-3">
        <input type="hidden" name="cardId" value={cardId} />
        {item.id && <input type="hidden" name="id" value={item.id} />}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <label className="space-y-1 text-xs">
            <span className="text-slate-500">{t('Varianta')}</span>
            <select name="variant" defaultValue={item.variant} className={small}>
              {variants.map((v) => (
                <option key={v} value={v}>
                  {t(VARIANT_LABEL[v])}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-slate-500">{t('Stav')}</span>
            <select name="condition" defaultValue={item.condition} className={small}>
              <option value="MINT">{t('Jako nová')}</option>
              <option value="LIGHT_PLAYED">{t('Mírně hraná')}</option>
              <option value="DAMAGED">{t('Poškozená')}</option>
            </select>
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-slate-500">{t('Jazyk')}</span>
            <select name="language" defaultValue={item.language} className={small}>
              {LANGS.map(([v, l]) => (
                <option key={v} value={v}>
                  {t(l)}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-slate-500">{t('Kusů celkem')}</span>
            <input name="quantity" type="number" min={1} max={999} defaultValue={item.quantity} className={small} />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-slate-500">{t('Z toho navíc')}</span>
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
          <label className="col-span-2 space-y-1 text-xs sm:col-span-1">
            <span className="text-slate-500">{t('Poznámka (max 30)')}</span>
            <input name="note" maxLength={30} defaultValue={item.note ?? ''} className={small} />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-slate-500">{t('Koupeno za (Kč/ks)')}</span>
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
        <p className="text-xs text-slate-400">📷 {t('Fotka vlastní karty (kvůli stavu) — připravujeme.')}</p>

        {spare > 0 && (
          <div className="flex flex-wrap items-end gap-2 rounded-xl bg-blue-50 p-3 dark:bg-blue-500/10">
            <label className="space-y-1 text-xs">
              <span className="text-slate-500">{t('Kusy navíc')}</span>
              <select name="offerType" value={offer} onChange={(e) => setOffer(e.target.value)} className={small}>
                <option value="TRADE">{t('vyměním')}</option>
                <option value="SELL">{t('prodám')}</option>
                <option value="GIFT">{t('daruji za poštovné')}</option>
              </select>
            </label>
            {offer === 'SELL' && (
              <label className="space-y-1 text-xs">
                <span className="text-slate-500">{t('Cena za kus (Kč)')}</span>
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
