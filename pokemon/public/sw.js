// Service worker kvůli instalaci webu jako aplikace. Nic necachuje — vše jde normálně ze sítě.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
self.addEventListener('fetch', () => {})
