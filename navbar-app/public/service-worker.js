/* global self */
/* eslint-disable no-restricted-globals */
// Workbox precache manifest placeholder (required)
/* eslint-disable no-undef */
self.__WB_MANIFEST = self.__WB_MANIFEST || [];

const APP_SHELL = [ '/', '/index.html', '/manifest.json' ];
const STATIC_CACHE = 'static-v1';
const RUNTIME_CACHE = 'runtime-v1';

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(APP_SHELL)).then(()=> self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => ![STATIC_CACHE, RUNTIME_CACHE].includes(k)).map(k => caches.delete(k)))).then(()=> self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (APP_SHELL.includes(url.pathname)) {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request)));
    return;
  }
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
