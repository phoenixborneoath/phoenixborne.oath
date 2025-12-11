const CACHE_NAME = 'pbo-v2'; // naikkan versi tiap perubahan signifikan
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/offline.html',
  '/styles.css',   // ubah kalau nama file css-mu berbeda
  '/main.js',      // ubah kalau nama js-mu berbeda
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k !== CACHE_NAME ? caches.delete(k) : null)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const req = event.request;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, resClone));
          return res;
        })
        .catch(() => caches.match('/offline.html'))
    );
    return;
  }

  if (req.method === 'GET') {
    event.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req)
          .then(resp => {
            if (!resp || resp.status !== 200 || resp.type !== 'basic') return resp;
            const respClone = resp.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, respClone));
            return resp;
          })
          .catch(() => {
            if (req.destination === 'image') return caches.match('/icons/icon-192.png');
            return caches.match('/offline.html');
          });
      })
    );
  }
});
