/* Scope is /translate/2/ only. Large lexical shards belong in IndexedDB, not CacheStorage. */
'use strict';
const CACHE = 'unicode-translate-2-shell-v1';
const SHELL = ['./','index.html','sample1.html','sample2.html','sample3.html','sample4.html','sample5.html','sample6.html','sample7.html','sample8.html','sample9.html','sample10.html','sample11.html','sample12.html','readme.html',
  'styles.css','personal.js','app.js','dictionary-worker.js','documentation.js','icon.svg','data/manifest.json','VALIDATION.md'];
self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  await cache.addAll(SHELL);
  const response = await cache.match('data/manifest.json');
  const manifest = await response.json();
  const notices = new Set(['licenses/CC-BY-SA-3.0.txt','licenses/CC-BY-3.0.txt','licenses/GPL-2.0-only.txt','licenses/ODC-By-1.0.txt','licenses/CECILL-C.txt','LICENSE.txt']);
  for (const source of Object.values(manifest.sources)) for (const path of source.notices) notices.add(path);
  // Include all original copyright/license notices with the offline app.
  await cache.addAll([...notices]);
  await self.skipWaiting();
})()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const key of await caches.keys()) if (key.startsWith('unicode-translate-2-shell-') && key !== CACHE) await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(new URL('./',self.location).pathname)) return;
  // Fetch no dictionary shards here. The worker verifies hashes and stores records atomically.
  if (url.pathname.endsWith('.ndjson.gz') || url.pathname.includes('/data/sources/')) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(event.request);
      // Only approved application/notice resources are eligible for this cache.
      const existing = await cache.match(event.request);
      if (response.ok && existing) await cache.put(event.request,response.clone());
      return response;
    } catch (error) {
      const response = await cache.match(event.request);
      if (response) return response;
      throw error;
    }
  })());
});
