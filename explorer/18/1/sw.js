'use strict';

const cachePrefix = `prime-explorer:${self.registration.scope}:`;
const cacheName = `${cachePrefix}v3`;
const appFiles = [
  'readme.html',
  'manifest.webmanifest',
  'prime-explorer.css?v=3',
  'prime-explorer.js?v=5',
  'icon-180.png',
  'icon-192.png',
  'icon-512.png',
  ...Array.from({ length: 24 }, (_, index) => `sample${index + 1}.html`),
];
const appURLs = new Set(appFiles.map(file => new URL(file, self.registration.scope).href));

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    await cache.addAll(appFiles.map(file => new Request(
      new URL(file, self.registration.scope), { cache: 'reload' },
    )));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith(cachePrefix) && key !== cacheName) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (event.request.mode === 'navigate') url.search = '';
  if (!appURLs.has(url.href)) return;

  event.respondWith(fetch(event.request).catch(async error => {
    const cache = await caches.open(cacheName);
    const response = await cache.match(url.href);
    if (response) return response;
    throw error;
  }));
});
