'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

/** Odešle zobrazení stránky do vlastního počítadla (/api/pv). Žádné cookies, žádné třetí strany. */
export function Analytics() {
  const pathname = usePathname()
  useEffect(() => {
    if (!pathname) return
    try {
      if (!navigator.sendBeacon?.('/api/pv', pathname)) fetch('/api/pv', { method: 'POST', body: pathname, keepalive: true })
    } catch {
      // statistika nesmí nic rozbít
    }
  }, [pathname])
  return null
}
