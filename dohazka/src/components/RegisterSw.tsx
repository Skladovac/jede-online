'use client'

import { useEffect } from 'react'

// Service worker je podmínkou instalace na plochu, proto se registruje vždy, ne až při zapnutí notifikací.
export function RegisterSw() {
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {})
  }, [])
  return null
}
