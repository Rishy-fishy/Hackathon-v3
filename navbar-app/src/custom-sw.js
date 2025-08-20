/* eslint-disable no-restricted-globals */
// Workbox InjectManifest target. CRA looks for self.__WB_MANIFEST usage after build.
import {precacheAndRoute} from 'workbox-precaching';
// self.__WB_MANIFEST will be injected at build time.
precacheAndRoute(self.__WB_MANIFEST || []);

const STATIC_CACHE = 'extras-v1';
const APP_SHELL = ['/','/index.html','/manifest.json'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(STATIC_CACHE).then(c=>c.addAll(APP_SHELL)));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  if (APP_SHELL.includes(url.pathname)) {
    e.respondWith(caches.match(e.request).then(r=> r || fetch(e.request)));
  }
});
