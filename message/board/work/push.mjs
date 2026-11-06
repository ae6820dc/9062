const encode = value => new TextEncoder().encode(value);
export const base64url = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
export function validPushEndpoint(value) {
  if(typeof value!=='string'||value.length>2048) return false;
  try {const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&(
    u.hostname==='fcm.googleapis.com'||u.hostname==='updates.push.services.mozilla.com'||u.hostname==='web.push.apple.com'||u.hostname.endsWith('.notify.windows.com'));
  } catch {return false;}
}
export async function vapidAuthorization(endpoint,env) {
  const header=base64url(encode(JSON.stringify({typ:'JWT',alg:'ES256'})));
  const claims=base64url(encode(JSON.stringify({aud:new URL(endpoint).origin,exp:Math.floor(Date.now()/1000)+3600,sub:env.VAPID_SUBJECT})));
  const input=header+'.'+claims;
  const key=await crypto.subtle.importKey('jwk',JSON.parse(env.VAPID_PRIVATE_KEY),{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
  const signature=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,encode(input));
  return 'vapid t='+input+'.'+base64url(signature)+', k='+env.VAPID_PUBLIC_KEY;
}
export async function notifySubscribers(env,sender,send=fetch) {
  if(!env.VAPID_PRIVATE_KEY||!env.VAPID_PUBLIC_KEY)return;
  const rows=await env.DB.prepare('SELECT p.endpoint FROM push_subscriptions p JOIN sessions s ON p.session=s.token WHERE s.expires>? AND s.token<>? LIMIT 500').bind(Math.floor(Date.now()/1000),sender).all();
  // A bodyless Web Push wakes the worker; no names or messages leave the board.
  for(let start=0;start<rows.results.length;start+=10) {
    await Promise.allSettled(rows.results.slice(start,start+10).map(async ({endpoint})=>{
      if(!validPushEndpoint(endpoint))return;
      const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),8000);
      try {
        const response=await send(endpoint,{method:'POST',headers:{Authorization:await vapidAuthorization(endpoint,env),TTL:'60',Urgency:'normal',Topic:'new-board-message'},body:null,signal:controller.signal,redirect:'manual'});
        if(response.status===404||response.status===410)await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint=?').bind(endpoint).run();
        else if(!response.ok)console.warn(JSON.stringify({event:'push_delivery_failed',status:response.status}));
      } finally {clearTimeout(timeout);}
    }));
  }
}
