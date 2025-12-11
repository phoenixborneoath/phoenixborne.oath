const CACHE_NAME = 'pbo-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/styles.css',
  '/main.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// install
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

// activate - cleanup
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(k => k !== CACHE_NAME ? caches.delete(k) : null)
    ))
  );
  self.clients.claim();
});

// fetch - cache-first strategy
self.addEventListener('fetch', event => {
  const req = event.request;
  // optional: ignore analytics or third-party calls
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(resp => {
        // optionally cache new GET requests
        if (req.method === 'GET' && resp && resp.status === 200 && resp.type === 'basic') {
          const respClone = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, respClone));
        }
        return resp;
      }).catch(() => {
        // fallback: return offline page or icon if exists
        return caches.match('/');
      });
    })
  );
});
