/* Basic PWA service worker for offline shell + dynamic caching.
  Generated for child nutrition app. */
/* eslint-disable no-restricted-globals */

const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
];

// Placeholder manifest usage to satisfy CRA workbox build (ignored at runtime if undefined)
// eslint-disable-next-line no-undef
const STATIC_CACHE = 'static-v1';
const RUNTIME_CACHE = 'runtime-v1';

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(APP_SHELL)).then(()=> self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => ![STATIC_CACHE, RUNTIME_CACHE].includes(k)).map(k => caches.delete(k))
    )).then(()=> self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // App shell strategy: cache-first for root & static
  if (APP_SHELL.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then(cached => cached || fetch(request))
    );
    return;
  }

  // Runtime: network-first with fallback to cache
  event.respondWith(
    fetch(request)
      .then(res => {
        const copy = res.clone();
        caches.open(RUNTIME_CACHE).then(cache => cache.put(request, copy));
        return res;
      })
      .catch(() => caches.match(request))
  );
});
