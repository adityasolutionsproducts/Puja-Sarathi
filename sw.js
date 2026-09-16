/* Puja Sarathi PWA Service Worker v1.0 */
const CACHE_NAME = 'puja-sarathi-v2-2025-09-15';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-72.png',
  './icons/icon-96.png',
  './icons/icon-144.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './aditya-logo-animated.svg'
];

// Install - cache core assets
self.addEventListener('install', (e) => {
  console.log('[SW] Install');
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(CORE_ASSETS).catch(err => {
        console.warn('[SW] Cache addAll failed', err);
        // Try individual
        return Promise.allSettled(CORE_ASSETS.map(url => cache.add(url).catch(()=>{})));
      });
    }).then(()=> self.skipWaiting())
  );
});

// Activate - clean old caches
self.addEventListener('activate', (e) => {
  console.log('[SW] Activate');
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    )).then(()=> self.clients.claim())
  );
});

// Fetch - Network first for Firebase/API, Cache first for local assets
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // Skip non-GET
  if(req.method !== 'GET') return;

  // Skip Firebase, googleapis, chrome-extension
  if(url.hostname.includes('firebaseio.com') || 
     url.hostname.includes('googleapis.com') ||
     url.hostname.includes('gstatic.com') ||
     url.hostname.includes('firebase') ||
     url.protocol === 'chrome-extension:') {
    // Network only, no cache
    return;
  }

  // For navigation requests - Network first, fallback to cache + index.html
  if(req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')){
    e.respondWith(
      fetch(req).then(res => {
        // Cache successful navigation
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, clone)).catch(()=>{});
        return res;
      }).catch(()=> {
        return caches.match(req).then(cached => {
          return cached || caches.match('./index.html') || caches.match('./');
        });
      })
    );
    return;
  }

  // For core assets - Cache first, then network
  e.respondWith(
    caches.match(req).then(cached => {
      if(cached) return cached;
      return fetch(req).then(res => {
        // Only cache successful, same-origin
        if(res.ok && url.origin === self.location.origin){
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, clone)).catch(()=>{});
        }
        return res;
      }).catch(()=> cached);
    })
  );
});

// Background sync & push placeholder
self.addEventListener('message', (e) => {
  if(e.data && e.data.type === 'SKIP_WAITING'){
    self.skipWaiting();
  }
});
