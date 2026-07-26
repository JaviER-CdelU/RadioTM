const CACHE = 'radio-tiempo-muerto-v2';
const ASSETS = [
  './', './index.html', './noticias.html', './comunidad.html', './corresponsales.html',
  './podcasts.html', './clima-rio.html', './aportes.html', './contacto.html',
  './ayuda.html', './admin-noticias.html', './admin-publicidades.html',
  './assets/css/estilos.css', './assets/js/principal.js',
  './assets/js/publicidades.js', './assets/js/firebase-config.js',
  './assets/img/logo-radio-tiempo-muerto.png', './assets/img/icon-192.png',
  './assets/img/icon-512.png', './manifest.webmanifest'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);
  // No interceptar la señal de radio, Firebase ni otros servicios externos.
  if (requestUrl.origin !== self.location.origin || event.request.headers.has('range')) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then(response => {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy));
        return response;
      }).catch(() => caches.match(event.request).then(response => response || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(event.request, copy));
      return response;
    }))
  );
});
