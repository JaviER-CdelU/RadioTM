const CACHE = 'radio-tiempo-muerto-v5-admin';
const ASSETS = [
  './', './index.html', './noticias.html', './comunidad.html', './corresponsales.html',
  './podcasts.html', './clima-rio.html', './aportes.html', './contacto.html',
  './ayuda.html', './admin.html', './admin-noticias.html', './admin-publicidades.html',
  './assets/css/estilos.css', './assets/js/principal.js',
  './assets/js/publicidades.js', './assets/js/firebase-config.js', './assets/js/admin-auth.js', './assets/js/admin-noticias.js',
  './assets/data/rio.json',
  './assets/img/logo-radio-tiempo-muerto.png', './assets/img/favicon-64.png',
  './assets/img/icon-192.png', './assets/img/icon-512.png', './manifest.webmanifest'
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

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch (_) {
    return (await cache.match(request)) || (await cache.match('./index.html'));
  }
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);
  // No interceptar la señal de radio, Firebase ni otros servicios externos.
  if (requestUrl.origin !== self.location.origin || event.request.headers.has('range')) return;

  const isHtml = requestUrl.pathname.endsWith('.html') || event.request.mode === 'navigate';
  const isRiverData = requestUrl.pathname.endsWith('/assets/data/rio.json');
  const isCodeOrConfig = requestUrl.pathname.endsWith('.js') || requestUrl.pathname.endsWith('.css') || requestUrl.pathname.endsWith('.webmanifest');
  if (isHtml || isRiverData || isCodeOrConfig) {
    event.respondWith(networkFirst(event.request));
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
