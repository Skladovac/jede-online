'use client'

import { useState, useTransition } from 'react'
import { revealPhone } from '@/app/actions/phone'
import { useT } from '@/lib/i18n/client'
import { Phone } from 'lucide-react'

const pill = 'inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line-strong bg-card px-3 py-1 text-sm text-fg transition-colors hover:bg-card-hover'

export function PhoneReveal({ ownerId }: { ownerId: string }) {
  const t = useT()
  const [res, setRes] = useState<{ phone: string } | { error: string } | null>(null)
  const [pending, start] = useTransition()
  if (res && 'phone' in res)
    return (
      <a href={`tel:${res.phone.replace(/\s/g, '')}`} className={`${pill} font-semibold tabular-nums`}>
        <Phone className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        {res.phone}
      </a>
    )
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setRes(await revealPhone(ownerId)))}
        className={`${pill} disabled:opacity-50`}
      >
        <Phone className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        {pending ? '…' : t('Zobrazit číslo')}
      </button>
      {res && 'error' in res && <span className="text-xs text-danger">{res.error}</span>}
    </span>
  )
}
