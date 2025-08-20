// Standard CRA service worker registration helper (modified)
/* eslint-disable no-console */
// We build a custom InjectManifest service worker (custom-sw.js -> service-worker.js in build root)
const swUrl = `${process.env.PUBLIC_URL}/service-worker.js`;

export function register() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register(swUrl)
        .then(reg => {
          console.log('Service worker registered:', reg.scope);
        })
        .catch(err => console.warn('Service worker registration failed', err));
    });
  }
}

export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(reg => reg.unregister());
  }
}
