'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { markAllRead } from '@/app/actions/notifications'

/** Po zobrazení stránky upozornění je označí jako přečtená (a zvoneček v liště zhasne). */
export function MarkRead({ unread }: { unread: number }) {
  const router = useRouter()
  useEffect(() => {
    if (unread) markAllRead().then(() => router.refresh())
  }, [unread, router])
  return null
}
