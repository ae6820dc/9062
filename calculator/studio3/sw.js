'use strict';
const CACHE='mathematics-studio-iii-0f6bc84e91a52d73-v2-en';
const FILES=['./','sample1.html','app.js','core.js','worker.js','style.css','icon.svg','readme.html','../advanced-algebra/math.js'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES.filter(x=>x!=='./'))).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('mathematics-studio-iii-0f6bc84e91a52d73-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;e.respondWith(fetch(e.request).then(r=>{if(r.ok&&FILES.some(f=>new URL(f==='./'?'sample1.html':f,self.location.href).href===e.request.url)){const copy=r.clone();e.waitUntil(caches.open(CACHE).then(c=>c.put(e.request,copy)));}return r;}).catch(()=>caches.match(e.request).then(r=>r||Response.error())));});
