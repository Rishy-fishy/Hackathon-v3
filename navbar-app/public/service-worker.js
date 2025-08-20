/* PWA Service Worker - static cache + network-first runtime.
   Note: No InjectManifest placeholder; operates standalone. */
/* eslint-disable no-restricted-globals */
const STATIC_CACHE = 'static-v2';
const RUNTIME_CACHE = 'runtime-v2';
const APP_SHELL = [ '/', '/index.html', '/manifest.json' ];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(STATIC_CACHE).then(c => c.addAll(APP_SHELL)).then(()=> self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => ![STATIC_CACHE, RUNTIME_CACHE].includes(k)).map(k => caches.delete(k)))).then(()=> self.clients.claim())
  );
});

function cacheFirst(req) {
  return caches.match(req).then(c => c || fetch(req));
}

function networkFirst(req) {
  return fetch(req).then(res => {
    const copy = res.clone();
    caches.open(RUNTIME_CACHE).then(c => c.put(req, copy));
    return res;
  }).catch(()=> caches.match(req));
}

self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // skip cross-origin
  if (APP_SHELL.includes(url.pathname)) {
    e.respondWith(cacheFirst(request));
    return;
  }
  e.respondWith(networkFirst(request));
});
