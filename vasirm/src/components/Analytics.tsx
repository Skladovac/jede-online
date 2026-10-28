'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

// Zdroj návštěvy posíláme jen s první stránkou — při přechodu mezi stránkami (bez obnovení) se nepočítá znovu.
let first = true

/** Odešle zobrazení stránky do vlastního počítadla (/api/pv). Žádné cookies, žádné třetí strany. */
export function Analytics() {
  const pathname = usePathname()
  useEffect(() => {
    if (!pathname) return
    const data: { p: string; r?: string; u?: string } = { p: pathname }
    if (first) {
      first = false
      data.r = document.referrer
      data.u = new URLSearchParams(location.search).get('utm_source') ?? ''
    }
    try {
      const body = JSON.stringify(data)
      if (!navigator.sendBeacon?.('/api/pv', body)) fetch('/api/pv', { method: 'POST', body, keepalive: true })
    } catch {
      // statistika nesmí nic rozbít
    }
  }, [pathname])
  return null
}
