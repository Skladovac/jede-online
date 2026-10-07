'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { addToCart } from '@/app/actions/requests'

export function AddToCart({ collectionItemId }: { collectionItemId: string }) {
  const [state, action, pending] = useActionState(addToCart, undefined)
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="collectionItemId" value={collectionItemId} />
      <button
        disabled={pending}
        className="rounded-full bg-yellow-400 px-4 py-1.5 text-sm font-semibold text-slate-900 hover:bg-yellow-300 disabled:opacity-50"
      >
        {pending ? '…' : 'Chci'}
      </button>
      {state?.ok && (
        <Link href="/kosik" className="text-xs text-green-700 underline dark:text-green-400">
          {state.ok} Do košíku →
        </Link>
      )}
      {state?.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  )
}
