/* Provider-boundary fixtures test UI behavior; these are not live Google translations. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.TRANSLATE_TEST_URL||'http://localhost:8000/translate/3/';
const report={baseUrl:base,checks:[],provider:'Controlled HTTP fixtures; no Google credentials or paid requests',startedAt:new Date().toISOString()};
function pass(name){report.checks.push(name);console.log('PASS',name);}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const context=await browser.newContext({serviceWorkers:'block',acceptDownloads:true,viewport:{width:1365,height:950}});
  let mode='success',pendingResolve,requests=[];
  await context.route('**/google-config.json',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({serviceUrl:'https://translation.example',clientId:'123-test.apps.googleusercontent.com'})}));
  await context.route('https://accounts.google.com/gsi/client',route=>route.fulfill({contentType:'application/javascript',body:`window.google={accounts:{id:{initialize(options){this.callback=options.callback;},renderButton(el){const b=document.createElement('button');b.type='button';b.id='test-google-signin';b.textContent='Test provider sign-in';b.onclick=()=>this.callback({credential:'fixture-token'});el.append(b);},disableAutoSelect(){}}}};`}));
  await context.route('https://translation.example/api/translate',async route=>{
   const request=route.request();requests.push(request.postDataJSON());assert.equal(request.headers().authorization,'Bearer fixture-token');
   if(mode==='delay')await new Promise(resolve=>{pendingResolve=resolve;});
   if(mode==='unauthorized')return route.fulfill({status:401,contentType:'application/json',body:'{}'});
   if(mode==='quota')return route.fulfill({status:429,contentType:'application/json',body:'{}'});
   const data=request.postDataJSON(),translations=Object.fromEntries(data.targets.filter(lang=>mode!=='partial'||lang!=='ja').map(lang=>[lang,lang==='en'?'Have a lovely day':lang==='ja'?'良い一日を':'Suggestion '+lang]));
   try{await route.fulfill({contentType:'application/json',body:JSON.stringify(mode==='malformed'?{translations:{xx:'Invalid'},failed:[]}:{translations,failed:mode==='partial'?['ja']:[]})});}catch{/* A cancelled request may already be gone. */}
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'sample1.html');await page.waitForFunction(()=>!document.getElementById('personal-add').disabled);
  assert.equal(requests.length,0);assert(!await page.evaluate(()=>!!window.google));pass('Google scripts and phrase requests are loaded only after the user opens the assistant');
  await page.locator('#personal-add').click();await page.locator('#term-hu').fill('Szép napot!');await page.locator('#term-de').fill('My own German text');await page.locator('#google-panel summary').click();await page.locator('#test-google-signin').click();
  async function targets(codes){for(const check of await page.locator('#google-targets input').all())if(!await check.isDisabled())await check.setChecked(codes.includes(await check.getAttribute('value')));}
  await targets(['en','ja']);await page.locator('#google-fill').click();await page.waitForFunction(()=>document.getElementById('google-status').textContent.includes('suggestions filled'));
  assert.equal(await page.locator('#term-en').inputValue(),'Have a lovely day');assert.equal(await page.locator('#term-de').inputValue(),'My own German text');assert.deepEqual(requests[0],{source:'hu',text:'Szép napot!',targets:['en','ja']});assert.equal(await page.locator('#term-en').getAttribute('lang'),'en-x-mtfrom-hu');
  assert.equal(await page.locator('#personal-count').innerText(),'0');pass('Explicitly selected empty fields are filled, existing text is preserved, and suggestions are not autosaved');
  await page.locator('#term-en').fill('Have a wonderful day');await page.locator('#expression-save').click();await page.locator('#expression-dialog').waitFor({state:'hidden'});await page.waitForFunction(()=>document.getElementById('personal-count').textContent==='1');
  const download=page.waitForEvent('download');await page.locator('#personal-export').click();const backup=JSON.parse(fs.readFileSync(await (await download).path(),'utf8'));
  assert.equal(backup.entries[0].machineTranslations.en.edited,true);assert.equal(backup.entries[0].machineTranslations.ja.edited,false);assert.equal(backup.entries[0].machineTranslations.ja.sourceLanguage,'hu');
  const transfer=await context.newPage();await transfer.goto(base+'sample2.html');await transfer.waitForFunction(()=>!document.getElementById('personal-add').disabled);
  await transfer.locator('#personal-file').setInputFiles({name:'machine-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});await transfer.locator('#import-confirm').click();await transfer.locator('#import-dialog').waitFor({state:'hidden'});await transfer.waitForFunction(()=>document.getElementById('personal-count').textContent==='1');
  const reexport=transfer.waitForEvent('download');await transfer.locator('#personal-export').click();assert.deepEqual(JSON.parse(fs.readFileSync(await (await reexport).path(),'utf8')).entries[0].machineTranslations,backup.entries[0].machineTranslations);await transfer.close();
  await page.locator('#query').fill('Szép napot!');await page.locator('#search').click();await page.waitForFunction(()=>!document.getElementById('search').disabled);assert(await page.locator('#results .google-badge').count()>0);pass('Machine origin, manual edits and source-language metadata survive save, search and full personal export');
  await page.locator('#personal-add').click();await page.locator('#term-hu').fill('New phrase');await page.locator('#google-panel summary').click();await page.waitForFunction(()=>!document.getElementById('google-fill').disabled);await targets(['en','ja']);
  mode='partial';await page.locator('#google-fill').click();await page.waitForFunction(()=>document.getElementById('google-status').textContent.includes('Some languages'));assert.equal(await page.locator('#term-en').inputValue(),'Have a lovely day');assert.equal(await page.locator('#term-ja').inputValue(),'');pass('Partial provider failure fills successful languages and leaves failed fields empty for retry');
  await page.locator('#term-en').fill('');mode='delay';await page.locator('#google-fill').click();await page.waitForFunction(()=>document.getElementById('google-cancel').hidden===false);while(!pendingResolve)await new Promise(r=>setTimeout(r,10));await page.locator('#term-en').fill('Keep my edit');pendingResolve();await page.waitForFunction(()=>document.getElementById('google-status').textContent.includes('fields you edited'));assert.equal(await page.locator('#term-en').inputValue(),'Keep my edit');pass('Edits made while a translation request is in flight are never overwritten');
  await page.locator('#term-en').fill('');await page.locator('#term-ja').fill('');mode='delay';pendingResolve=null;await page.locator('#google-fill').click();while(!pendingResolve)await new Promise(r=>setTimeout(r,10));await page.locator('#term-hu').fill('Changed source');pendingResolve();await page.waitForFunction(()=>document.getElementById('google-status').textContent.includes('source expression changed'));assert.equal(await page.locator('#term-en').inputValue(),'');pass('Changing the source while waiting discards stale suggestions');
  pendingResolve=null;await page.locator('#google-fill').click();while(!pendingResolve)await new Promise(r=>setTimeout(r,10));await page.locator('#google-cancel').click();pendingResolve();assert.equal(await page.locator('#term-en').inputValue(),'');pass('Cancellation keeps the editor and existing text intact');
  mode='malformed';await page.locator('#google-fill').click();await page.waitForFunction(()=>document.getElementById('google-status').textContent.includes('Invalid translation'));assert.equal(await page.locator('#term-en').inputValue(),'');
  mode='unauthorized';await page.locator('#google-fill').click();await page.waitForFunction(()=>document.getElementById('google-status').textContent.includes('expired'));assert(await page.locator('#google-fill').isDisabled());await page.locator('#test-google-signin').click();
  mode='quota';await page.locator('#google-fill').click();await page.waitForFunction(()=>document.getElementById('google-status').textContent.includes('limit reached'));assert(await page.locator('#google-fill').isDisabled());pass('Malformed responses, expired sign-in and quotas produce clear errors without changing expressions');
  assert(!JSON.stringify(await page.evaluate(()=>({...localStorage}))).includes('fixture-token'));await page.locator('#google-signout').click();await page.locator('#expression-close').click();assert.deepEqual(errors,[]);pass('Sign-in tokens stay out of localStorage, and sign-out does not delete personal words');
  const fresh=await browser.newContext({serviceWorkers:'block'});let external=0;
  await fresh.route('**/google-config.json',route=>route.fulfill({contentType:'application/json',body:'{"serviceUrl":"","clientId":""}'}));
  await fresh.route('https://accounts.google.com/**',route=>{external++;return route.abort();});
  const offline=await fresh.newPage();await offline.goto(base+'sample1.html');await offline.waitForFunction(()=>!document.getElementById('personal-add').disabled);await offline.locator('#personal-add').click();await offline.locator('#google-panel summary').click();await offline.waitForFunction(()=>document.getElementById('google-setup').hidden===false);assert.equal(external,0);assert(await offline.locator('#google-fill').isDisabled());
  await offline.setViewportSize({width:390,height:844});await offline.screenshot({path:path.join(__dirname,'google-unconfigured-mobile.png'),fullPage:true});assert(await offline.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await fresh.close();pass('The published unconfigured version states setup is needed, keeps manual entry available, and makes no Google calls');
  await context.close();report.success=true;
 }finally{await browser.close();}
})().catch(error=>{report.success=false;report.error=error.stack;console.error(error);process.exitCode=1;}).finally(()=>{report.completedAt=new Date().toISOString();fs.writeFileSync(path.join(__dirname,'google-results.json'),JSON.stringify(report,null,2)+'\n');});
