const CACHE='unicode-9-sample1-pwa-v1';
const ASSETS=['./sample1.html','./manifest1.webmanifest','./icons/app1-192.png','./icons/app1-512.png','./icons/app1-maskable-192.png','./icons/app1-maskable-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||event.request.mode!=='navigate')return;const url=new URL(event.request.url);if(url.origin!==self.location.origin||url.pathname!=='/9062/unicode/9/sample1.html')return;event.respondWith(fetch(event.request).catch(()=>caches.match('./sample1.html')));});
