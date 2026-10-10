'use client'

import { useState, useTransition } from 'react'
import { revealPhone } from '@/app/actions/phone'
import { useT } from '@/lib/i18n/client'

export function PhoneReveal({ ownerId }: { ownerId: string }) {
  const t = useT()
  const [res, setRes] = useState<{ phone: string } | { error: string } | null>(null)
  const [pending, start] = useTransition()
  if (res && 'phone' in res)
    return (
      <a href={`tel:${res.phone.replace(/\s/g, '')}`} className="rounded-full border border-line-strong px-3 py-1 text-sm font-semibold">
        📞 {res.phone}
      </a>
    )
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setRes(await revealPhone(ownerId)))}
        className="rounded-full border border-line-strong px-3 py-1 text-sm hover:border-line-strong disabled:opacity-50"
      >
        📞 {pending ? '…' : t('Zobrazit číslo')}
      </button>
      {res && 'error' in res && <span className="text-xs text-red-600">{res.error}</span>}
    </span>
  )
}
