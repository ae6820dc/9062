const CACHE='unicode-9-sample2-pwa-v1';
const ASSETS=['./sample2.html','./manifest2.webmanifest','./icons/app2-192.png','./icons/app2-512.png','./icons/app2-maskable-192.png','./icons/app2-maskable-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||event.request.mode!=='navigate')return;const url=new URL(event.request.url);if(url.origin!==self.location.origin||url.pathname!=='/9062/unicode/9/sample2.html')return;event.respondWith(fetch(event.request).catch(()=>caches.match('./sample2.html')));});
