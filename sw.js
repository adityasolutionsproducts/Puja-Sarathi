/* Puja Sarathi — minimal service worker.
   Network-first pass-through: keeps the PWA installable without changing the
   app's own update behavior. Replace with an offline-cache strategy if the
   hosted PWA needs one. */
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
