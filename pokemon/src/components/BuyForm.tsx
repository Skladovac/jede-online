'use client'

import { useActionState, useState } from 'react'
import { saveCardBuy, saveProductBuy } from '@/app/actions/buy'
import { Alert, inputCls } from '@/components/ui'
import { CONDITION_LABEL, LANGS, VARIANT_LABEL } from '@/lib/labels'
import { useT } from '@/lib/i18n/client'

const small = inputCls.replace('py-2.5', 'py-2') + ' text-sm'

type CardWant = { buy: boolean; maxPriceCzk: number | null; variant: string | null; minCondition: string | null; language: string | null }

/** „Chci koupit“ u chybějící karty: zaškrtnutí + nejvyšší cena, pokročile varianta, stav a jazyk. */
export function CardBuyForm({ cardId, variants, want }: { cardId: string; variants: string[]; want: CardWant | null }) {
  const t = useT()
  const [state, action, pending] = useActionState(saveCardBuy, undefined)
  const [buy, setBuy] = useState(want?.buy ?? false)
  return (
    <form action={action} className="space-y-3 rounded-panel border-2 border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-500/40 dark:bg-emerald-500/10">
      <input type="hidden" name="cardId" value={cardId} />
      <label className="flex items-center gap-2 font-semibold text-emerald-900 dark:text-emerald-200">
        <input type="checkbox" name="buy" checked={buy} onChange={(e) => setBuy(e.target.checked)} className="h-4 w-4" />
        💰 {t('Chci koupit')}
      </label>
      {buy && (
        <>
          <label className="block space-y-1 text-sm">
            <span className="text-emerald-900/80 dark:text-emerald-200/80">{t('Zaplatím nejvýš (Kč, nepovinné)')}</span>
            <input name="maxPriceCzk" inputMode="numeric" defaultValue={want?.maxPriceCzk ?? ''} placeholder={t('např. {n}', { n: 150 })} className={small + ' max-w-[10rem]'} />
          </label>
          <details className="text-sm">
            <summary className="cursor-pointer text-emerald-800 dark:text-emerald-300">{t('Podrobnosti (varianta, stav, jazyk)')}</summary>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <label className="space-y-1 text-xs">
                <span className="text-subtle">{t('Varianta')}</span>
                <select name="variant" defaultValue={want?.variant ?? ''} className={small}>
                  <option value="">{t('je mi to jedno')}</option>
                  {variants.map((v) => (
                    <option key={v} value={v}>
                      {t(VARIANT_LABEL[v])}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-subtle">{t('Stav nejméně')}</span>
                <select name="minCondition" defaultValue={want?.minCondition ?? ''} className={small}>
                  <option value="">{t('je mi to jedno')}</option>
                  <option value="MINT">{t(CONDITION_LABEL.MINT)}</option>
                  <option value="LIGHT_PLAYED">{t(CONDITION_LABEL.LIGHT_PLAYED)}</option>
                </select>
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-subtle">{t('Jazyk')}</span>
                <select name="language" defaultValue={want?.language ?? ''} className={small}>
                  <option value="">{t('je mi to jedno')}</option>
                  {LANGS.map(([v, l]) => (
                    <option key={v} value={v}>
                      {t(l)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </details>
          <p className="text-xs text-emerald-900/70 dark:text-emerald-200/70">
            {t('Poptávku uvidí ostatní u karty i na tvém profilu. Kdo kartu nabízí, dostane upozornění.')}
          </p>
        </>
      )}
      <button
        disabled={pending}
        className="rounded-full bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {pending ? t('Ukládám…') : t('Uložit')}
      </button>
      <Alert state={state} />
    </form>
  )
}

/** „Chci koupit“ u produktu. */
export function ProductBuyForm({ productId, want }: { productId: number; want: { buy: boolean; maxPriceCzk: number | null } | null }) {
  const t = useT()
  const [state, action, pending] = useActionState(saveProductBuy, undefined)
  const [buy, setBuy] = useState(want?.buy ?? false)
  return (
    <form action={action} className="space-y-3 rounded-panel border-2 border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-500/40 dark:bg-emerald-500/10">
      <input type="hidden" name="productId" value={productId} />
      <label className="flex items-center gap-2 font-semibold text-emerald-900 dark:text-emerald-200">
        <input type="checkbox" name="buy" checked={buy} onChange={(e) => setBuy(e.target.checked)} className="h-4 w-4" />
        💰 {t('Chci koupit')}
      </label>
      {buy && (
        <label className="block space-y-1 text-sm">
          <span className="text-emerald-900/80 dark:text-emerald-200/80">{t('Zaplatím nejvýš (Kč, nepovinné)')}</span>
          <input name="maxPriceCzk" inputMode="numeric" defaultValue={want?.maxPriceCzk ?? ''} placeholder={t('např. {n}', { n: 1200 })} className={small + ' max-w-[10rem]'} />
        </label>
      )}
      <button
        disabled={pending}
        className="rounded-full bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {pending ? t('Ukládám…') : t('Uložit')}
      </button>
      <Alert state={state} />
    </form>
  )
}
