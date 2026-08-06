const CACHE = 'calivia-v2';
const NAV_ASSETS = ['/', '/index.html'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(NAV_ASSETS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // La navegación (index.html) siempre va primero a la red: así el HTML
  // nunca queda desfasado apuntando a un bundle .js con un hash que ya no
  // existe en el despliegue actual (eso dejaba la app en pantalla blanca).
  // Solo si no hay red, caemos al cache como respaldo offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(req, clone)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('/index.html')))
    );
    return;
  }

  // Los assets con hash de contenido en el nombre (JS/CSS de Vite) son
  // inmutables: un archivo con ese nombre nunca cambia, así que cache-first
  // es seguro y rápido para ellos.
  const url = new URL(req.url);
  if (/\/assets\/.+\.[a-zA-Z0-9]{8,}\.(js|css)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(req, clone)).catch(() => {});
          }
          return res;
        });
      })
    );
    return;
  }

  // Todo lo demás (imágenes, manifest, etc.): red primero, cache como respaldo.
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(req, clone)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
