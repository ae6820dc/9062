import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import worker from './worker.mjs';
const sql=new DatabaseSync(':memory:');sql.exec(readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));
class Statement {
  constructor(query,params=[]) {this.query=query;this.params=params;}
  bind(...params){return new Statement(this.query,params);}
  async first(){return sql.prepare(this.query).get(...this.params)||null;}
  async all(){return {results:sql.prepare(this.query).all(...this.params)};}
  async run(){const r=sql.prepare(this.query).run(...this.params);return {meta:{changes:Number(r.changes),size_after:57344}};}
}
const env={DB:{prepare:q=>new Statement(q),batch:async statements=>{sql.exec('BEGIN');try{const results=[];for(const s of statements)results.push(/^SELECT/.test(s.query)?await s.all():await s.run());sql.exec('COMMIT');return results;}catch(e){sql.exec('ROLLBACK');throw e;}}},SETUP_TOKEN:'test-setup-secret',PASSWORD_PEPPER:'test-pepper-secret',ALLOWED_ORIGIN:'https://ae6820dc.github.io'};
const ctx={waitUntil:p=>p.catch(e=>{throw e;})};
let ip=0;
async function call(path,body,token='',origin=env.ALLOWED_ORIGIN){
  const response=await worker.fetch(new Request('https://worker.test'+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'CF-Connecting-IP':'test-'+ip,...(body!==undefined?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)}),env,ctx);
  return {status:response.status,data:await response.json(),headers:response.headers};
}
assert.equal((await call('/api/messages')).status,401);
assert.equal((await call('/api/status',undefined,'','https://evil.test')).status,403);
assert.equal((await call('/api/setup',{setupToken:'bad',password:'abcdefgh'})).status,403);
assert.equal((await call('/api/setup',{setupToken:env.SETUP_TOKEN,password:'abcdefgh'})).status,200);
assert.equal((await call('/api/setup',{setupToken:env.SETUP_TOKEN,password:'different'})).status,409);
assert.equal((await call('/api/login',{name:'A',password:'wrong'})).status,401);
const a=await call('/api/login',{name:'Árvíztűrő',password:'abcdefgh'});assert.equal(a.status,200);
const b=await call('/api/login',{name:'Kolléga',password:'abcdefgh'});assert.equal(b.status,200);
const text='<script>alert(1)</script> 😀';
const sent=await call('/api/messages',{body:text,nonce:'nonce-0001'},a.data.token);assert.equal(sent.status,201);
const retry=await call('/api/messages',{body:text,nonce:'nonce-0001'},a.data.token);assert.equal(retry.data.message.id,sent.data.message.id);
assert.equal((await call('/api/messages',undefined,b.data.token)).data.messages[0].body,text);
assert.equal((await call('/api/messages?after='+sent.data.message.id,undefined,b.data.token)).data.messages.length,0);
assert.equal((await call('/api/messages?before=-1',undefined,b.data.token)).status,400);
assert.equal((await call('/api/messages',{body:'x'.repeat(4001),nonce:'nonce-0002'},a.data.token)).status,400);
for(let i=0;i<55;i++)sql.prepare('INSERT INTO messages(name,body,created,nonce,session) VALUES (?,?,?,?,?)').run('test','message '+i,1,'n'+i,'fixture');
const recent=await call('/api/messages',undefined,b.data.token);assert.equal(recent.data.messages.length,50);assert.equal(recent.data.hasOlder,true);
assert.equal((await call('/api/messages?before='+recent.data.messages[0].id,undefined,b.data.token)).data.messages.length,6);
await call('/api/logout',{},a.data.token);assert.equal((await call('/api/messages',undefined,a.data.token)).status,401);
assert.equal((await call('/api/messages',undefined,b.data.token)).status,200);
ip++;for(let i=0;i<20;i++)await call('/api/login',{name:'X',password:'bad'});
assert.equal((await call('/api/login',{name:'X',password:'abcdefgh'})).status,429);
console.log('Passed: setup, access control, passwords, independent sessions, message persistence, idempotency, pagination, validation, logout, rate limits.');
