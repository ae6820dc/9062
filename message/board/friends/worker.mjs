import {pruneOldestIfNeeded} from './retention.mjs';
// Cloudflare Worker. Secrets are supplied as bindings, never in this source.
const enc = new TextEncoder();
const hex = buffer => Array.from(new Uint8Array(buffer), b => b.toString(16).padStart(2,'0')).join('');
const digest = async value => hex(await crypto.subtle.digest('SHA-256', enc.encode(value)));
async function equal(a,b) {
  const key = await crypto.subtle.importKey('raw',enc.encode('board-constant-time-comparison-key'),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  const sig = await crypto.subtle.sign('HMAC',key,enc.encode(a));
  return crypto.subtle.verify('HMAC',key,sig,enc.encode(b));
}
async function passwordHash(password,salt,pepper) {
  const hkey = await crypto.subtle.importKey('raw',enc.encode(pepper),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const material = await crypto.subtle.sign('HMAC',hkey,enc.encode(password));
  const key = await crypto.subtle.importKey('raw',material,'PBKDF2',false,['deriveBits']);
  return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:enc.encode(salt),iterations:100000},key,256));
}
function fail(message,status=400) { throw {message,status}; }
async function limited(db,key,max,window,now) {
  const bucket = Math.floor(now/window)*window;
  const row = await db.prepare(`INSERT INTO limits(key,start,count) VALUES (?, ?, 1)
    ON CONFLICT(key) DO UPDATE SET start=excluded.start, count=CASE WHEN limits.start=excluded.start THEN limits.count+1 ELSE 1 END RETURNING count`).bind(key,bucket).first();
  if(row.count>max) fail('Túl sok próbálkozás. Várj egy kicsit, majd próbáld újra.',429);
}
async function bodyOf(request) {
  if(!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) fail('JSON kérés szükséges.',415);
  if(Number(request.headers.get('Content-Length'))>24000) fail('Túl hosszú kérés.',413);
  const reader=request.body?.getReader(); if(!reader) fail('Üres kérés.');
  const chunks=[]; let size=0;
  while(true) { const {value,done}=await reader.read(); if(done) break; size+=value.length; if(size>24000) {await reader.cancel();fail('Túl hosszú kérés.',413);} chunks.push(value); }
  const bytes=new Uint8Array(size); let offset=0; for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  try {const data=JSON.parse(new TextDecoder().decode(bytes));if(!data||Array.isArray(data)||typeof data!=='object') fail('Hibás kérés.');return data;} catch {fail('Hibás JSON kérés.');}
}
async function route(request,env,ctx) {
  const url=new URL(request.url), path=url.pathname, db=env.DB, now=Math.floor(Date.now()/1000);
  const method=request.method;
  if(method==='OPTIONS') return new Response(null,{status:204});
  if(method==='GET'&&path==='/health') {await db.prepare('SELECT 1').first();return Response.json({ok:true});}
  if(method==='GET'&&path==='/api/status') return Response.json({configured:!!await db.prepare("SELECT 1 FROM settings WHERE key='password'").first()});
  if(method==='POST'&&(path==='/api/setup'||path==='/api/login')) {
    const ip=await digest(request.headers.get('CF-Connecting-IP')||'unknown');
    await limited(db,'auth:'+ip,20,900,now);
    const data=await bodyOf(request);
    const stored=await db.prepare("SELECT value FROM settings WHERE key='password'").first();
    if(path==='/api/setup') {
      if(stored) fail('Az üzenőfal jelszava már be van állítva.',409);
      if(typeof data.setupToken!=='string'||data.setupToken.length>160||!env.SETUP_TOKEN||!await equal(data.setupToken,env.SETUP_TOKEN)) fail('Érvénytelen beállítási kulcs.',403);
      if(typeof data.password!=='string'||data.password.length<8||data.password.length>128) fail('A jelszó 8–128 karakter legyen.');
      const salt=crypto.randomUUID(); const hash=await passwordHash(data.password,salt,env.PASSWORD_PEPPER);
      const result=await db.prepare("INSERT OR IGNORE INTO settings VALUES ('password',?)").bind(JSON.stringify({salt,hash})).run();
      if(result.meta.changes!==1) fail('A jelszó már be van állítva.',409);
      return Response.json({ok:true});
    }
    if(!stored) fail('Az üzenőfal jelszava még nincs beállítva.',503);
    if(typeof data.name!=='string'||data.name.trim().length<1||data.name.trim().length>40) fail('Adj meg egy 1–40 karakteres nevet.');
    if(typeof data.password!=='string'||data.password.length>128) fail('Hibás jelszó.',401);
    const saved=JSON.parse(stored.value);
    if(!await equal(await passwordHash(data.password,saved.salt,env.PASSWORD_PEPPER),saved.hash)) fail('Hibás jelszó.',401);
    const token=crypto.randomUUID()+crypto.randomUUID();
    await db.prepare('INSERT INTO sessions VALUES (?,?,?)').bind(await digest(token),data.name.trim(),now+43200).run();
    ctx.waitUntil(db.batch([db.prepare('DELETE FROM sessions WHERE expires<=?').bind(now),db.prepare('DELETE FROM limits WHERE start<?').bind(now-86400)]));
    return Response.json({token,name:data.name.trim()});
  }
  if(!['/api/messages','/api/logout'].includes(path)) fail('Nincs ilyen oldal.',404);
  const bearer=request.headers.get('Authorization')||'';
  const session= bearer.startsWith('Bearer ')&&bearer.length<160 ? await db.prepare('SELECT token,name FROM sessions WHERE token=? AND expires>?').bind(await digest(bearer.slice(7)),now).first():null;
  if(!session) fail('Jelentkezz be az üzenőfalhoz.',401);
  if(path==='/api/logout'&&method==='POST') {await db.prepare('DELETE FROM sessions WHERE token=?').bind(session.token).run();return Response.json({ok:true});}
  if(path==='/api/messages'&&method==='GET') {
    const read=n=>{const value=url.searchParams.get(n)||'0';if(!/^\d+$/.test(value)||!Number.isSafeInteger(Number(value))) fail('Hibás lapozás.');return Number(value);};
    const after=read('after'),before=read('before'); let rows;
    if(url.searchParams.has('after')) rows=(await db.prepare('SELECT id,name,body,created FROM messages WHERE id>? ORDER BY id LIMIT 100').bind(after).all()).results;
    else if(before) rows=(await db.prepare('SELECT id,name,body,created FROM messages WHERE id<? ORDER BY id DESC LIMIT 50').bind(before).all()).results.reverse();
    else rows=(await db.prepare('SELECT id,name,body,created FROM messages ORDER BY id DESC LIMIT 50').all()).results.reverse();
    const hasOlder=!!await db.prepare('SELECT 1 FROM messages WHERE id<? LIMIT 1').bind(rows[0]?.id||before).first();
    return Response.json({messages:rows,hasOlder,name:session.name});
  }
  if(path==='/api/messages'&&method==='POST') {
    const data=await bodyOf(request);
    if(typeof data.body!=='string'||data.body.trim().length<1||data.body.trim().length>4000) fail('Az üzenet 1–4000 karakter legyen.');
    if(typeof data.nonce!=='string'||data.nonce.length<8||data.nonce.length>80) fail('Hibás üzenetazonosító.');
    await limited(db,'send:'+session.token,15,30,now);
    await pruneOldestIfNeeded(db);
    const results=await db.batch([
      db.prepare('INSERT OR IGNORE INTO messages(name,body,created,nonce,session) VALUES (?,?,?,?,?)').bind(session.name,data.body.trim(),now,data.nonce,session.token),
      db.prepare('SELECT id,name,body,created FROM messages WHERE session=? AND nonce=?').bind(session.token,data.nonce)
    ]);
    return Response.json({message:results[1].results[0]},{status:201});
  }
  fail('Nem támogatott művelet.',405);
}
export default {
  async fetch(request,env,ctx) {
    const origin=request.headers.get('Origin');
    const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Vary':'Origin'};
    if(origin===env.ALLOWED_ORIGIN) Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Methods':'GET, POST, OPTIONS'});
    try {
      if(origin&&origin!==env.ALLOWED_ORIGIN&&origin!==new URL(request.url).origin) fail('Erről az oldalról nem érhető el az üzenőfal.',403);
      const response=await route(request,env,ctx);for(const [k,v] of Object.entries(headers)) response.headers.set(k,v);return response;
    } catch(error) {
      if(!error.status) console.error(JSON.stringify({event:'request_failed',path:new URL(request.url).pathname}));
      return Response.json({error:error.status?error.message:'A szolgáltatás most nem elérhető. Próbáld újra később.'},{status:error.status||503,headers});
    }
  }
};
