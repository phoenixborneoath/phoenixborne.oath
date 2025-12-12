const CACHE_NAME = 'pbo-v4';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/offline.html',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

function isSafeCacheUrl(url) {
  try {
    const u = new URL(url, self.location.href);
    return (u.protocol === 'https:' || u.protocol === 'http:') && (u.origin === self.location.origin);
  } catch (e) {
    return false;
  }
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const results = await Promise.allSettled(
      ASSETS_TO_CACHE.map(async url => {
        if (!isSafeCacheUrl(url)) {
          console.warn('Skipping (unsafe) cache URL:', url);
          return {url, ok: false, reason: 'unsafe-url'};
        }
        try {
          const resp = await fetch(url, {cache: 'no-store'});
          if (!resp || !(resp.ok) ) throw new Error('Bad response ' + (resp && resp.status));
          await cache.put(url, resp.clone()); // store by url string
          return {url, ok: true};
        } catch (err) {
          return Promise.reject({url, reason: err.message});
        }
      })
    );

    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.warn('Failed to cache:', ASSETS_TO_CACHE[i], r.reason);
      } else if (r.value && r.value.ok === false) {
        console.warn('Skipped caching:', r.value.url, r.value.reason);
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

  // navigations: network-first, fallback offline.html
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(res => {
        // simpan versi navigasi jika valid
        if (isSafeCacheUrl(req.url) && res && res.ok) {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then(cache => {
            try { cache.put(req.url, resClone); } catch (e) { /* ignore */ }
          });
        }
        return res;
      }).catch(() => caches.match('/offline.html'))
    );
    return;
  }

  // assets: cache-first
  if (req.method === 'GET') {
    event.respondWith(
      caches.match(req.url).then(cached => {
        if (cached) return cached;
        return fetch(req).then(resp => {
          if (!resp || !(resp.ok)) return resp;
          // jika same-origin dan aman, cache
          if (isSafeCacheUrl(req.url)) {
            const toCache = resp.clone();
            caches.open(CACHE_NAME).then(cache => {
              try { cache.put(req.url, toCache); } catch (e) { /* ignore */ }
            });
          }
          return resp;
        }).catch(() => {
          // fallback kalau network error
          if (req.destination === 'image') return caches.match('/icons/icon-192.png');
          return caches.match('/offline.html');
        });
      })
    );
  }
});
