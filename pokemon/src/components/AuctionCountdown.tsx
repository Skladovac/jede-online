'use client'

import { useEffect, useState } from 'react'
import { useT } from '@/lib/i18n/client'

/** „končí za 2 d 4 h“ / „končí za 15 min“ / „skončila“ — obnovuje se každých 30 s. */
export function AuctionCountdown({ endsAt, className = '' }: { endsAt: string; className?: string }) {
  const t = useT()
  const end = new Date(endsAt).getTime()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])
  const left = end - now
  if (left <= 0) return <span className={className}>{t('skončila')}</span>
  const min = Math.floor(left / 60_000)
  const d = Math.floor(min / 1440)
  const h = Math.floor((min % 1440) / 60)
  const m = min % 60
  const text = d > 0 ? `${d} d ${h} h` : h > 0 ? `${h} h ${m} min` : `${Math.max(1, m)} min`
  return (
    <span className={className} suppressHydrationWarning>
      {t('končí za {time}', { time: text })}
    </span>
  )
}
