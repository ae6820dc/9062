const CACHE="pwa-v2-calculator-calculus-analysis";
const ASSETS=["./icons/app1-192.png", "./icons/app1-512.png", "./icons/app1-maskable-192.png", "./icons/app1-maskable-512.png", "./icons/app2-192.png", "./icons/app2-512.png", "./icons/app2-maskable-192.png", "./icons/app2-maskable-512.png", "config.js", "config2.js", "engine.js", "manifest1.webmanifest", "manifest2.webmanifest", "math.js", "pwa-icon.svg", "sample1.html", "sample2.html", "style.css", "ui.js", "worker.js"];
const ROOT=new URL('./',self.location.href);
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==ROOT.origin||!url.pathname.startsWith(ROOT.pathname))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  try {const response=await fetch(event.request,{cache:'no-cache'});
   if(response.ok)await cache.put(event.request,response.clone());
   return response;
  }catch {return await cache.match(event.request)||Response.error();}
 })());
});
