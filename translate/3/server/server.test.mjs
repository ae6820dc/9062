import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {parseConfig,validateRequest,createHandler,createQuotaReservation,HttpError} from './service.mjs';
const config=parseConfig({GOOGLE_CLOUD_PROJECT:'translate-project',GOOGLE_CLIENT_ID:'123-test.apps.googleusercontent.com',ALLOWED_GOOGLE_EMAILS:'owner@gmail.com'});
async function service(t,overrides={}){
  const reservations=[],calls=[];
  const handler=createHandler({config,verifyToken:async token=>{if(token==='expired')throw Error('bad token');return{sub:'owner-sub',email:token==='stranger'?'stranger@gmail.com':'owner@gmail.com',email_verified:true};},reserveQuota:async input=>reservations.push(input),translate:async input=>{calls.push(input);return 'Translated '+input.target;},...overrides});
  const server=http.createServer(handler);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
  const url='http://127.0.0.1:'+server.address().port;
  const send=(body={source:'hu',text:'Szép napot!',targets:['en','ja']},options={})=>fetch(url+(options.path||'/api/translate'),{method:options.method||'POST',headers:{Origin:'https://ae6820dc.github.io','Content-Type':'application/json',Authorization:'Bearer owner',...options.headers},...(options.method==='GET'||options.method==='OPTIONS'?{}:{body:typeof body==='string'?body:JSON.stringify(body)})});
  return{send,reservations,calls};
}
test('Configuration fails closed without an allowed account and validates origins and limits',()=>{
 assert.throws(()=>parseConfig({}),/Set a valid/);
 assert.throws(()=>parseConfig({GOOGLE_CLOUD_PROJECT:'translate-project',GOOGLE_CLIENT_ID:config.clientId,ALLOWED_GOOGLE_EMAILS:'owner@gmail.com',ALLOWED_ORIGINS:'https://example.com/path'}),/HTTPS origins/);
 assert.throws(()=>parseConfig({GOOGLE_CLOUD_PROJECT:'translate-project',GOOGLE_CLIENT_ID:config.clientId,ALLOWED_GOOGLE_EMAILS:'owner@gmail.com',DAILY_CHARACTER_LIMIT:'NaN'}),/DAILY/);
});
test('Unicode, bounded text, target whitelist, deduplication and multiplicative quota counting',()=>{
 assert.equal(validateRequest({source:'ja',text:'水😀',targets:['en','hu']}).characters,4);
 for(const body of [{source:'xx',text:'x',targets:['en']},{source:'hu',text:'x',targets:['en','en']},{source:'hu',text:'x',targets:['hu']},{source:'hu',text:'x'.repeat(4097),targets:['en']}])assert.throws(()=>validateRequest(body));
});
test('Successful authenticated translation uses plain text input and reserves every selected target',async t=>{
 const {send,reservations,calls}=await service(t);const response=await send();assert.equal(response.status,200);assert.deepEqual((await response.json()).translations,{en:'Translated en',ja:'Translated ja'});assert.equal(reservations[0].characters,22);assert.equal(calls.length,2);assert.equal(response.headers.get('cache-control'),'no-store');
});
test('No billing for missing/expired/unauthorized identities or a forged origin',async t=>{
 const {send,reservations}=await service(t);
 for(const [headers,status] of [[{Authorization:''},401],[{Authorization:'Bearer expired'},401],[{Authorization:'Bearer stranger'},403],[{Origin:'https://evil.example'},403]])assert.equal((await send(undefined,{headers})).status,status);
 assert.equal(reservations.length,0);
});
test('Non-Google email allowlists cannot substitute for a pinned Google subject',async t=>{
 const {send}=await service(t,{verifyToken:async()=>({sub:'third-party',email:'owner@gmail.com',email_verified:false})});assert.equal((await send()).status,403);
});
test('Malformed, oversized and unsupported-method requests never reserve quota',async t=>{
 const {send,reservations}=await service(t);
 assert.equal((await send('{bad')).status,400);assert.equal((await send('x'.repeat(25000))).status,413);assert.equal((await send(undefined,{method:'GET'})).status,405);assert.equal((await send(undefined,{headers:{'Content-Type':'text/plain'}})).status,415);assert.equal(reservations.length,0);
});
test('CORS preflight is explicit and does not call Google',async t=>{
 const {send,calls}=await service(t);const response=await send(undefined,{method:'OPTIONS'});assert.equal(response.status,204);assert.equal(response.headers.get('access-control-allow-origin'),'https://ae6820dc.github.io');assert.equal(calls.length,0);
});
test('Daily quota exhaustion and quota-store failures fail closed without Google calls',async t=>{
 for(const error of [new HttpError(429,'Daily translation allowance reached.'),new Error('store unavailable')]){
  const {send,calls}=await service(t,{reserveQuota:async()=>{throw error;}});assert.equal((await send()).status,error.status||503);assert.equal(calls.length,0);
 }
});
test('Provider failure returns a partial result without exposing errors or inventing translations',async t=>{
 const {send}=await service(t,{translate:async({target})=>{if(target==='ja')throw Error('secret upstream detail');return '<plain text>';}});
 const response=await send(),body=await response.json();assert.equal(response.status,200);assert.deepEqual(body.translations,{en:'<plain text>'});assert.deepEqual(body.failed,['ja']);assert(!JSON.stringify(body).includes('secret'));
});
test('All failed provider requests return a safe unavailable message',async t=>{
 const {send}=await service(t,{translate:async()=>{throw Error('credential');}});const r=await send();assert.equal(r.status,503);assert(!(await r.text()).includes('credential'));
});
test('Per-minute request limiting prevents repeated paid requests',async t=>{
 const {send,calls}=await service(t);for(let i=0;i<10;i++)assert.equal((await send()).status,200);assert.equal((await send()).status,429);assert.equal(calls.length,20);
});
test('Persistent quota reservation reads both counters and commits only within the cap',async()=>{
 const writes=[],data=new Map();let fail=false;
 const db={collection:name=>({doc:id=>({path:name+'/'+id})}),runTransaction:async action=>{
  const staged=[];await action({get:async ref=>({exists:data.has(ref.path),data:()=>data.get(ref.path)}),set:(ref,value)=>staged.push([ref.path,value])});if(fail)throw Error('storage failure');for(const [key,value]of staged){data.set(key,value);writes.push(key);}
 }};
 const reserve=createQuotaReservation(db),request={characters:7,subject:'subject-hash',day:'2026-10-29',limit:10};
 await reserve(request);assert.equal(writes.length,2);await assert.rejects(()=>reserve(request),error=>error.status===429);assert.equal(writes.length,2);
 fail=true;await assert.rejects(()=>reserve({...request,characters:1}));assert.equal(data.get('translate3_daily_usage/2026-10-29').characters,7);
});
