const CACHE_NAME = 'pbo-v3'; // naikkan versi setiap update SW
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/offline.html',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/styles.css', // ganti jika nama file CSS-mu beda
  '/main.js'     // ganti jika nama file JS-mu beda
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // fetch each asset and add to cache only if fetch ok
    const results = await Promise.allSettled(
      ASSETS_TO_CACHE.map(url =>
        fetch(url, {cache: "no-store"}).then(resp => {
          if (!resp || resp.status !== 200) throw new Error(`Bad response ${resp && resp.status} for ${url}`);
          return cache.put(url, resp.clone()).then(() => ({url, ok: true}));
        })
      )
    );

    // optional: log failures to console (visible in SW console)
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.warn('Failed to cache:', ASSETS_TO_CACHE[i], r.reason);
      }
    });

    self.skipWaiting();
  })());
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
          // update cache for navigation responses
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
