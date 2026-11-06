'use strict';
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
  event.waitUntil(self.registration.showNotification('Munkahely · Üzenőfal',{
    body:'Új üzenet érkezett a munkahelyi falra. Koppints a megnyitáshoz.',
    icon:new URL('icon.svg',self.registration.scope).href,
    tag:'work-board-message',data:{url:self.registration.scope}
  }));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const target=self.registration.scope;
    const tabs=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const existing=tabs.find(tab=>tab.url.startsWith(target));
    if(existing){await existing.focus();return;}
    await self.clients.openWindow(target);
  })());
});
