'use strict';

function configureNewsWorker(files, legacyCache) {
  const scope = new URL(self.registration.scope);
  const prefix = '9062-news-pwa:' + scope.pathname + ':';
  const cacheName = prefix + '2';
  const index = new URL('index.html', scope).href;
  const assets = new Set(files.map(file => new URL(file, scope).href));

  self.addEventListener('install', event => {
    event.waitUntil((async () => {
      const cache = await caches.open(cacheName);
      const requests = [index, ...assets].map(url => new Request(url, { cache: 'reload' }));
      await cache.addAll(requests);
      await self.skipWaiting();
    })());
  });

  self.addEventListener('activate', event => {
    event.waitUntil((async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter(key => key === legacyCache ||
        (key.startsWith(prefix) && key !== cacheName)).map(key => caches.delete(key)));
      await self.clients.claim();
    })());
  });

  self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    const canonical = url.origin + url.pathname;
    const page = request.mode === 'navigate' && (canonical === scope.href || canonical === index);
    if (!page && !assets.has(canonical)) return;

    event.respondWith((async () => {
      const cache = await caches.open(cacheName);
      const key = page ? index : canonical;
      try {
        const response = await fetch(request);
        if (response.ok) {
          try {
            await cache.put(key, response.clone());
          } catch {}
          return response;
        }
        return await cache.match(key) || response;
      } catch {
        return await cache.match(key) || Response.error();
      }
    })());
  });
}
