const CACHE_NAME = 'pbo-v4';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/offline.html',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
  // jangan masukkan /styles.css atau /main.js di sini kalau kamu tidak yakin nama asli.
];

function isSafeCacheUrl(url) {
  try {
    const u = new URL(url, self.location.href);
    // hanya cache http(s) dan same-origin (atau at least https from same origin)
    return (u.protocol === 'https:' || u.protocol === 'http:') && (u.origin === location.origin);
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
          if (!resp || resp.status !== 200) throw new Error('Bad response ' + (resp && resp.status));
          await cache.put(url, resp.clone());
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

  // navigations: network-first, fallback offline
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const resClone = res.clone();
          if (isSafeCacheUrl(req.url) && res && res.status === 200) {
            caches.open(CACHE_NAME).then(cache => {
              try { cache.put(req, resClone); } catch (e) { /* ignore invalid schemes */ }
            });
          }
          return res;
        })
        .catch(() => caches.match('/offline.html'))
    );
    return;
  }

  // assets: cache-first
  if (req.method === 'GET') {
    event.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req)
          .then(resp => {
            if (!resp || resp.status !== 200) return resp;
            if (isSafeCacheUrl(req.url)) {
              caches.open(CACHE_NAME).then(cache => {
                try { cache.put(req, resp.clone()); } catch (e) { /* ignore */ }
              });
            }
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
