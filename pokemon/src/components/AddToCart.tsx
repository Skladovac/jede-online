'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { addToCart } from '@/app/actions/requests'
import { useT } from '@/lib/i18n/client'
import { btnPrimary } from '@/components/design'
import { ArrowRight } from 'lucide-react'

export function AddToCart({ collectionItemId, productItemId }: { collectionItemId?: string; productItemId?: string }) {
  const t = useT()
  const [state, action, pending] = useActionState(addToCart, undefined)
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      {collectionItemId && <input type="hidden" name="collectionItemId" value={collectionItemId} />}
      {productItemId && <input type="hidden" name="productItemId" value={productItemId} />}
      <button
        disabled={pending}
        className={`${btnPrimary} !min-h-9 !px-4 !py-1.5 text-sm disabled:opacity-50`}
      >
        {pending ? '…' : t('Chci')}
      </button>
      {state?.ok && (
        <Link href="/kosik" className="inline-flex items-center gap-1 text-xs text-positive underline underline-offset-4">
          {state.ok} {t('Do košíku')}
          <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        </Link>
      )}
      {state?.error && <span className="text-xs text-danger">{state.error}</span>}
    </form>
  )
}
