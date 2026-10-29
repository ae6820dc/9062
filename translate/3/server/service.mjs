/* HTTP boundary independent of Google SDKs so security and error paths are testable. */
import {createHash} from 'node:crypto';
export const LANGUAGES=new Set(['hu','en','de','fr','es','it','ru','ja','la']);
export class HttpError extends Error {constructor(status,message){super(message);this.status=status;}}
export function parseConfig(env){
  const project=env.GOOGLE_CLOUD_PROJECT,clientId=env.GOOGLE_CLIENT_ID;
  const allowedSubjects=(env.ALLOWED_GOOGLE_SUBJECTS||'').split(',').map(s=>s.trim()).filter(Boolean);
  const allowedEmails=(env.ALLOWED_GOOGLE_EMAILS||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
  const origins=(env.ALLOWED_ORIGINS||'https://ae6820dc.github.io').split(',').map(s=>s.trim());
  const dailyLimit=Number(env.DAILY_CHARACTER_LIMIT||10000);
  if(!/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(project||'')||!/^\d+-[\w-]+\.apps\.googleusercontent\.com$/.test(clientId||'')||(!allowedSubjects.length&&!allowedEmails.length))throw new Error('Set a valid GOOGLE_CLOUD_PROJECT, GOOGLE_CLIENT_ID and an account allowlist before starting.');
  if(!Number.isSafeInteger(dailyLimit)||dailyLimit<1||dailyLimit>100000)throw new Error('DAILY_CHARACTER_LIMIT must be between 1 and 100000.');
  for(const origin of origins){const u=new URL(origin);if(u.protocol!=='https:'||u.origin!==origin)throw new Error('ALLOWED_ORIGINS must contain exact HTTPS origins.');}
  return {project,clientId,allowedSubjects:new Set(allowedSubjects),allowedEmails:new Set(allowedEmails),origins:new Set(origins),dailyLimit};
}
export function validateRequest(body){
  if(!body||typeof body!=='object'||Array.isArray(body)||!LANGUAGES.has(body.source)||typeof body.text!=='string'||!Array.isArray(body.targets))throw new HttpError(400,'Invalid translation request.');
  const text=body.text.trim().normalize('NFC');
  if(!text||text.length>4096||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffd]/u.test(text)||body.targets.length<1||body.targets.length>8||new Set(body.targets).size!==body.targets.length||body.targets.some(lang=>!LANGUAGES.has(lang)||lang===body.source))throw new HttpError(400,'Choose a source expression and one to eight other supported languages.');
  return {source:body.source,text,targets:body.targets,characters:[...text].length*body.targets.length};
}
async function readJson(req){
  const chunks=[];let size=0;
  for await(const chunk of req){size+=chunk.length;if(size>24000)throw new HttpError(413,'Request too large.');chunks.push(chunk);}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new HttpError(400,'Invalid JSON.');}
}
export function createHandler({config,verifyToken,reserveQuota,translate,now=Date.now}){
  const minute=new Map();let inFlight=0;
  return async(req,res)=>{
    const origin=req.headers.origin;
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Vary','Origin');
    function reply(status,payload){if(res.writableEnded||res.destroyed)return;res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(payload));}
    try{
      if(req.url==='/health'&&req.method==='GET'){reply(200,{status:'ok'});return;}
      if(!config.origins.has(origin))throw new HttpError(403,'Origin not allowed.');
      res.setHeader('Access-Control-Allow-Origin',origin);
      if(req.url!=='/api/translate')throw new HttpError(404,'Not found.');
      if(req.method==='OPTIONS'){
        res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');res.setHeader('Access-Control-Max-Age','600');res.writeHead(204);res.end();return;
      }
      if(req.method!=='POST')throw new HttpError(405,'Use POST.');
      if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))throw new HttpError(415,'Use JSON.');
      const bearer=/^Bearer ([\w.-]+)$/.exec(req.headers.authorization||'');
      if(!bearer||bearer[1].length>10000)throw new HttpError(401,'Sign in with Google.');
      let identity;
      try{identity=await verifyToken(bearer[1]);}catch{throw new HttpError(401,'Sign in again.');}
      if(!identity?.sub||identity.email_verified!==true)throw new HttpError(403,'Verified Google account required.');
      // Third-party emails alone are not sufficient; use an explicit stable Google subject.
      const authoritative=identity.email?.toLowerCase().endsWith('@gmail.com')||!!identity.hd;
      if(!config.allowedSubjects.has(identity.sub)&&!(authoritative&&config.allowedEmails.has(identity.email?.toLowerCase())))throw new HttpError(403,'Account not allowed.');
      const input=validateRequest(await readJson(req));
      const bucket=Math.floor(now()/60000),key=createHash('sha256').update(identity.sub).digest('hex');
      for(const [id,record] of minute)if(record.bucket!==bucket)minute.delete(id);
      const record=minute.get(key)||{bucket,count:0};
      if(record.count>=10||inFlight>=4){res.setHeader('Retry-After','60');throw new HttpError(429,'Please wait before requesting more translations.');}
      record.count++;minute.set(key,record);inFlight++;
      const operation=new AbortController(),onClose=()=>operation.abort();
      res.once('close',onClose);const deadline=setTimeout(()=>operation.abort(),25000);
      try{
        // The shared persistent reservation bounds costs across concurrent instances and restarts.
        await reserveQuota({characters:input.characters,subject:key,day:new Date(now()).toISOString().slice(0,10),limit:config.dailyLimit});
        const translations={},failed=[];
        // Keep at most two Google requests per browser request active.
        for(let i=0;i<input.targets.length;i+=2){
          if(operation.signal.aborted)break;
          const batch=input.targets.slice(i,i+2);
          const results=await Promise.allSettled(batch.map(target=>translate({source:input.source,target,text:input.text,signal:operation.signal})));
          results.forEach((result,index)=>{
            const value=result.status==='fulfilled'?result.value:null;
            if(typeof value==='string'&&value.trim()&&value.length<=4096&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffd]/u.test(value))translations[batch[index]]=value.normalize('NFC');
            else failed.push(batch[index]);
          });
        }
        for(const target of input.targets)if(!Object.hasOwn(translations,target)&&!failed.includes(target))failed.push(target);
        if(!Object.keys(translations).length)throw new HttpError(503,'Google Translate is temporarily unavailable.');
        reply(200,{translations,failed,provider:'google'});
      }finally{clearTimeout(deadline);res.removeListener('close',onClose);inFlight--;}
    }catch(error){reply(error instanceof HttpError?error.status:503,{error:error instanceof HttpError?error.message:'Translation service temporarily unavailable.'});}
  };
}
export function createQuotaReservation(db){
  return async({characters,subject,day,limit})=>{
    const global=db.collection('translate3_daily_usage').doc(day),user=db.collection('translate3_user_usage').doc(day+'_'+subject);
    await db.runTransaction(async tx=>{
      const [total,personal]=await Promise.all([tx.get(global),tx.get(user)]);
      const used=total.exists?total.data().characters:0,own=personal.exists?personal.data().characters:0;
      if(!Number.isSafeInteger(used)||!Number.isSafeInteger(own)||used<0||own<0)throw new Error('Invalid quota state.');
      if(used+characters>limit||own+characters>limit)throw new HttpError(429,'Daily translation allowance reached.');
      tx.set(global,{characters:used+characters});tx.set(user,{characters:own+characters});
    });
  };
}
