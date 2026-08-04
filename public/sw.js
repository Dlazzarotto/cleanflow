// Service worker mínimo: permite instalar o app na tela inicial
// e mantém a última página acessível quando a rede oscila.
const CACHE = 'cleanflow-v1';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((chaves) =>
      Promise.all(chaves.filter((c) => c !== CACHE).map((c) => caches.delete(c)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Só páginas de navegação; dados sempre vão à rede
  if (e.request.mode !== 'navigate') return;
  e.respondWith(
    fetch(e.request).catch(() =>
      caches.match(e.request).then((r) => r || caches.match('/minha-agenda'))
    )
  );
});
