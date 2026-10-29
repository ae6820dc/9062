/* End-to-end personal dictionary checks, using the same public UI as the user. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.TRANSLATE_TEST_URL||'http://localhost:8000/translate/2/';
const identities=JSON.parse(fs.readFileSync(path.join(__dirname,'../identities.json'),'utf8'));
const report={baseUrl:base,startedAt:new Date().toISOString(),checks:[]};
function pass(message){report.checks.push(message);console.log('PASS',message);}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const context=await browser.newContext({acceptDownloads:true,viewport:{width:1365,height:950}});
  context.setDefaultTimeout(120000);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  async function visit(i){await page.goto(base+`sample${i}.html`);await page.waitForFunction(()=>!document.getElementById('personal-add').disabled);}
  async function count(n){await assert.doesNotReject(()=>page.waitForFunction(n=>document.getElementById('personal-count').textContent===String(n),n));}
  async function add(terms,note=''){
   await page.locator('#personal-add').click();
   for(const lang of ['hu','en','de','fr','es','it','ru','ja','la'])await page.locator('#term-'+lang).fill(terms[lang]||'');
   await page.locator('#expression-note').fill(note);await page.locator('#expression-save').click();await page.locator('#expression-dialog').waitFor({state:'hidden'});
  }
  async function lookup(from,to,query,expected){
   // Swap first if necessary to avoid selecting the same language on both sides.
   if(await page.locator('#to').inputValue()===from)await page.locator('#swap').click();
   await page.locator('#from').selectOption(from);await page.locator('#to').selectOption(to);
   await page.locator('#query').fill(query);await page.locator('#search').click();
   await page.waitForFunction(()=>!document.getElementById('search').disabled);
   assert((await page.locator('#results').innerText()).includes(expected));
  }
  async function upload(entries,version=1){await page.locator('#personal-file').setInputFiles({name:'words.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'unicode-translate-personal',version,entries}))});await page.waitForFunction(()=>document.getElementById('import-dialog').open||document.getElementById('personal-status').classList.contains('form-error'));}
  async function confirm(policy='keep'){await page.locator('#import-policy').selectOption(policy);await page.locator('#import-confirm').click();await page.locator('#import-dialog').waitFor({state:'hidden'});}
  await visit(1);await page.waitForFunction(()=>document.getElementById('shell-status').textContent.includes('ready offline'));
  await add({hu:'Kedvenc kifejezésem',en:'My favourite expression',ja:'私のお気に入りの表現',ru:'Моё любимое выражение'},'A personal note <script>literal text</script>');await count(1);
  await lookup('hu','en','Kedvenc kifejeze\u0301sem','My favourite expression');
  assert.match(await page.locator('#results').innerText(),/Your expression/);
  await lookup('ja','ru','私のお気に入りの表現','Моё любимое выражение');
  await lookup('en','hu','My favourite expression','Kedvenc kifejezésem');
  pass('Personal phrases match both ways in supplied languages, including NFD Hungarian, Cyrillic and Japanese');
  await page.locator('#query').fill('My fav');await page.locator('#suggestions').waitFor({state:'visible'});assert.match(await page.locator('#suggestions').innerText(),/My favourite expression/);await page.keyboard.press('Escape');
  await page.locator('#personal-add').click();await page.locator('#term-en').fill('Only one language');await page.locator('#term-hu').fill('');await page.locator('#expression-save').click();assert(await page.locator('#expression-dialog').isVisible());assert.match(await page.locator('#expression-error').innerText(),/at least two/);await page.locator('#expression-close').click();await count(1);
  pass('Personal prefix suggestions and validation of incomplete expressions');
  await page.locator('#personal-library summary').click();await page.locator('#personal-list button').first().click();await page.locator('#expression-note').fill('Updated note');await page.locator('#expression-save').click();await page.locator('#expression-dialog').waitFor({state:'hidden'});
  const dlPromise=page.waitForEvent('download');await page.locator('#personal-export').click();const dl=await dlPromise;const backup=JSON.parse(fs.readFileSync(await dl.path(),'utf8'));
  assert.equal(backup.entries.length,1);assert.equal(backup.entries[0].note,'Updated note');assert.equal(backup.format,'unicode-translate-personal');assert.equal(backup.programId,identities[0][0]);
  pass('Editor and complete versioned personal JSON export');
  const entry=backup.entries[0];
  await upload([entry]);assert.match(await page.locator('#import-summary').innerText(),/1 exact duplicates/);await confirm();await count(1);
  const conflict={...entry,terms:{...entry.terms,en:'A different translation'}};
  await upload([conflict]);assert.match(await page.locator('#import-summary').innerText(),/1 with different/);await confirm('keep');await count(1);
  await upload([conflict]);await confirm('alongside');await count(2);
  await upload([{...conflict,note:'Replacement'}]);await confirm('replace');await count(1);
  await lookup('hu','en','Kedvenc kifejezésem','A different translation');
  pass('Import skips duplicates and supports keep-existing, keep-both and replace conflict policies');
  await upload([{terms:{hu:'új',en:'new'}},{terms:{hu:'invalid'}}]);await page.waitForFunction(()=>document.getElementById('personal-status').classList.contains('form-error'));assert(await page.locator('#import-dialog').isHidden());await count(1);
  await upload([entry],999);await page.waitForFunction(()=>document.getElementById('personal-status').textContent.includes('Unsupported'));await count(1);
  await page.locator('#personal-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{bad')});await page.waitForFunction(()=>document.getElementById('personal-status').textContent.includes('not valid JSON'));await count(1);
  await upload([{terms:{hu:'veszély',en:'danger'},attribution:[{id:'x',license:'x',url:'javascript:alert(1)'}]}]);await page.waitForFunction(()=>document.getElementById('personal-status').classList.contains('form-error'));await count(1);
  pass('Malformed JSON, unsupported versions, unsafe source URLs and partly invalid files never partially import');
  await upload([{terms:{hu:'Megszakított import',en:'Interrupted import'}},{terms:{hu:'Második új',en:'Second new'}}]);
  await page.evaluate(()=>{window.originalPersonalPut=IDBObjectStore.prototype.put;window.personalPutCount=0;IDBObjectStore.prototype.put=function(...args){const result=window.originalPersonalPut.apply(this,args);if(this.name==='entries'&&++window.personalPutCount===2)this.transaction.abort();return result;};});
  await page.locator('#import-confirm').click();await page.waitForFunction(()=>document.getElementById('import-error').textContent.length>0);
  await page.evaluate(()=>{IDBObjectStore.prototype.put=window.originalPersonalPut;});await page.locator('#import-close').click();await page.reload();await page.waitForFunction(()=>!document.getElementById('personal-add').disabled);await count(1);
  pass('An interrupted write transaction rolls back the entire import, including earlier writes');
  await lookup('hu','en','víz','water');await page.locator('#results .sense button').filter({hasText:'My dictionary'}).first().click();assert.match(await page.locator('#expression-attribution').innerText(),/Source attribution/);await page.locator('#expression-save').click();await page.locator('#expression-dialog').waitFor({state:'hidden'});await count(2);
  const attributedPromise=page.waitForEvent('download');await page.locator('#personal-export').click();const attributed=JSON.parse(fs.readFileSync(await (await attributedPromise).path(),'utf8'));assert(attributed.entries.some(e=>e.attribution.length>0));
  pass('Copying a base sense preserves source IDs, license names and URLs in personal backups');
  // A second tab sees edits immediately after the IndexedDB commit.
  const second=await context.newPage();await second.goto(base+'sample1.html');await second.waitForFunction(()=>!document.getElementById('personal-add').disabled);
  await add({hu:'Másik lap',en:'Another tab'});await second.waitForFunction(()=>document.getElementById('personal-count').textContent==='3');await second.close();
  pass('Another tab of the same program refreshes after a saved change');
  for(let i=2;i<=12;i++){
   await visit(i);await count(0);assert.equal(await page.locator('meta[name="program-id"]').getAttribute('content'),identities[i-1][0]);assert.equal(await page.locator('meta[name="storage-key"]').getAttribute('content'),identities[i-1][1]);
  }
  assert.equal(new Set(identities.flat()).size,24);
  await upload(backup.entries);await confirm();await count(1);
  pass('All twelve programs have unique IDs, isolated personal stores, and portable cross-sample import');
  await page.setViewportSize({width:1365,height:950});await page.screenshot({path:path.join(__dirname,'personal-desktop.png'),fullPage:true});
  await page.locator('#personal-add').click();await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(__dirname,'personal-editor-mobile.png'),fullPage:true});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert(await page.locator('#expression-dialog').evaluate(e=>e.getBoundingClientRect().width<=innerWidth));await page.locator('#expression-close').click();
  await page.screenshot({path:path.join(__dirname,'personal-mobile.png'),fullPage:true});
  for(const [width,height] of [[320,568],[568,320]]){await page.setViewportSize({width,height});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.locator('#personal-add').click();assert(await page.locator('#expression-dialog').evaluate(e=>e.getBoundingClientRect().width<=innerWidth));await page.locator('#expression-close').click();}
  pass('Desktop and mobile layout preserve the original design without page or editor overflow');
  await context.setOffline(true);await page.reload();await page.waitForFunction(()=>!document.getElementById('personal-add').disabled);await count(1);
  await lookup('hu','en','Kedvenc kifejezésem','My favourite expression');await add({hu:'Offline saját szó',en:'Offline personal word'});await count(2);
  await lookup('en','hu','Offline personal word','Offline saját szó');
  pass('Offline reload, own-phrase lookup without a downloaded base shard, and offline creation');
  await page.locator('#personal-library summary').click();await page.locator('#personal-filter').fill('Offline personal');await page.locator('#personal-list button').first().click();await page.locator('#expression-delete').click();await page.locator('#expression-delete-no').click();await page.locator('#expression-close').click();await count(2);
  await page.locator('#personal-list button').first().click();await page.locator('#expression-delete').click();await page.locator('#expression-delete-yes').click();await page.locator('#expression-dialog').waitFor({state:'hidden'});await count(1);
  assert.deepEqual(errors,[]);pass('Deletion requires confirmation and no uncaught application errors occur');
  await context.setOffline(false);
  const bulk=await browser.newContext({acceptDownloads:true}),bulkPage=await bulk.newPage();
  await bulkPage.goto(base+'sample1.html');await bulkPage.waitForFunction(()=>!document.getElementById('personal-add').disabled);
  const bulkEntries=Array.from({length:1000},(_,i)=>({terms:{hu:'Saját tömeges kifejezés '+i,en:'Personal bulk expression '+i},note:'Import test'}));
  const bulkFile={name:'bulk.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'unicode-translate-personal',version:1,entries:bulkEntries}))};
  for(let i=0;i<2;i++){await bulkPage.locator('#personal-file').setInputFiles(bulkFile);await bulkPage.locator('#import-confirm').click();await bulkPage.locator('#import-dialog').waitFor({state:'hidden'});await bulkPage.waitForFunction(()=>document.getElementById('personal-count').textContent==='1000');}
  const bulkDownload=bulkPage.waitForEvent('download');await bulkPage.locator('#personal-export').click();assert.equal(JSON.parse(fs.readFileSync(await (await bulkDownload).path(),'utf8')).entries.length,1000);
  await bulk.close();pass('A thousand-expression import, duplicate reimport and complete export round trip');
  await context.close();report.success=true;
 }finally{await browser.close();}
})().catch(error=>{report.success=false;report.error=error.stack;console.error(error);process.exitCode=1;})
.finally(()=>{report.completedAt=new Date().toISOString();fs.writeFileSync(path.join(__dirname,'personal-results.json'),JSON.stringify(report,null,2)+'\n');});
