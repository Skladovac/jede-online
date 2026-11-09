// Service worker: instalace webu jako aplikace a push notifikace. Nic necachuje — vše jde normálně ze sítě.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
// Prázdný fetch handler: Chrome ho dříve vyžadoval pro nabídku instalace na plochu. Nic necachuje.
self.addEventListener('fetch', () => {})

self.addEventListener('push', (e) => {
  let data = {}
  try {
    data = e.data ? e.data.json() : {}
  } catch {
    data = { title: e.data ? e.data.text() : '' }
  }
  e.waitUntil(
    self.registration.showNotification(data.title || 'Docházka', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url || '/' },
    }),
  )
})

// Klepnutí na notifikaci: otevřít stránku (nebo přepnout na už otevřené okno webu).
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  // Cíl musí zůstat na našem webu: absolutní adresa nebo „//cizí.web“ by otevřela cizí stránku.
  let target = new URL('/', self.location.origin)
  try {
    const u = new URL(e.notification.data?.url || '/', self.location.origin)
    if (u.origin === self.location.origin) target = u
  } catch {}
  const url = target.href
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) {
          c.navigate(url).catch(() => {})
          return c.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
