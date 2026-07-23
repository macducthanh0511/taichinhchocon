const CACHE_NAME = 'heovang-v1';
const CORE_ASSETS = ['/index.html', '/clay.css', '/icon-192.png', '/icon-512.png', '/manifest.json'];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) { return cache.addAll(CORE_ASSETS); })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE_NAME; }).map(function (k) { return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;

  // HTML pages: network-first, so content updates are seen immediately when online
  if (event.request.mode === 'navigate' || (event.request.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then(function (res) {
          var copy = res.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, copy); });
          return res;
        })
        .catch(function () { return caches.match(event.request).then(function (r) { return r || caches.match('/index.html'); }); })
    );
    return;
  }

  // Static assets (css/images): cache-first, refresh in background
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      var fetchPromise = fetch(event.request).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, copy); });
        return res;
      }).catch(function () { return cached; });
      return cached || fetchPromise;
    })
  );
});
