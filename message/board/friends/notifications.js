'use strict';
let boardPushRegistration=null;
function supportsBoardPush(){return 'Notification' in window&&'serviceWorker' in navigator&&'PushManager' in window;}
function pushButton(enabled){const b=document.getElementById('notifications');if(!b)return;b.textContent=enabled?'🔔 Értesítések bekapcsolva':'🔔 Értesítések bekapcsolása';b.setAttribute('aria-pressed',String(enabled));}
async function pushRegistration(){
  if(!boardPushRegistration)boardPushRegistration=await navigator.serviceWorker.register('./sw.js?v=20261106push',{scope:'./'});
  if(!boardPushRegistration.active)await new Promise(resolve=>{const worker=boardPushRegistration.installing||boardPushRegistration.waiting;if(!worker){resolve();return;}worker.addEventListener('statechange',()=>{if(worker.state==='activated')resolve();});if(worker.state==='activated')resolve();});
  return boardPushRegistration;
}
async function restoreBoardNotifications(){
  if(!supportsBoardPush()||Notification.permission!=='granted'){pushButton(false);return;}
  try {const registration=await pushRegistration();const subscription=await registration.pushManager.getSubscription();if(subscription){await api('/api/notifications/subscribe',{endpoint:subscription.endpoint});pushButton(true);}else pushButton(false);}catch{pushButton(false);}
}
document.getElementById('notifications').addEventListener('click',async event=>{
  const button=event.currentTarget;
  if(!supportsBoardPush()){notify('Ez a böngésző nem támogatja az értesítéseket. Nyisd meg az oldalt Chrome-ban.');return;}
  button.disabled=true;
  try {
    if(button.getAttribute('aria-pressed')==='true'){
      const registration=await pushRegistration(),subscription=await registration.pushManager.getSubscription();
      if(subscription){await api('/api/notifications/unsubscribe',{endpoint:subscription.endpoint});await subscription.unsubscribe();}
      pushButton(false);notify('Az értesítéseket kikapcsoltad ezen az eszközön.');return;
    }
    const permission=await Notification.requestPermission();
    if(permission!=='granted'){notify('Az értesítésekhez engedély szükséges. Ha korábban letiltottad, a böngésző webhelybeállításaiban engedélyezheted.');return;}
    const registration=await pushRegistration();const {publicKey}=await api('/api/notifications/key');
    const normalized=publicKey.replace(/-/g,'+').replace(/_/g,'/');const bytes=Uint8Array.from(atob(normalized+'='.repeat((4-normalized.length%4)%4)),c=>c.charCodeAt(0));
    let subscription=await registration.pushManager.getSubscription();
    if(!subscription)subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});
    await api('/api/notifications/subscribe',{endpoint:subscription.endpoint});
    pushButton(true);clearNotice();notify('Értesítések bekapcsolva. Új üzenetnél jelezni fog ez az eszköz.');
  }catch(error){notify(error.message||'Az értesítéseket most nem sikerült bekapcsolni.');}finally{button.disabled=false;}
});
