const PREFIX = 'factorial-96-v37:' + self.registration.scope;
const CACHE = PREFIX + 'v2';
const FILES = ['./96.html', './manifest-96.webmanifest', './icon-96-192.png', './icon-96-512.png'];
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(FILES);
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  const page = new URL('./96.html', self.location.href);
  if (event.request.mode === 'navigate' && url.pathname === page.pathname) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      return await cache.match(page.href) || fetch(event.request);
    })());
  } else if (FILES.some(file => new URL(file, self.registration.scope).href === url.href)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      return await cache.match(event.request) || fetch(event.request);
    })());
  }
});
