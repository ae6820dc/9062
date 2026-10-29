/* Real Chromium integration checks against the bundled dictionary, no fake lexical fixtures. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TRANSLATE_TEST_URL || 'http://localhost:8000/translate/3/';
const report = {startedAt:new Date().toISOString(),checks:[],browser:null,baseUrl:base};
function passed(name) {report.checks.push(name); console.log('PASS',name);}
(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox']});
  report.browser = browser.version();
  try {
    const context = await browser.newContext({permissions:['clipboard-read','clipboard-write'],acceptDownloads:true,viewport:{width:1365,height:950}});
    context.setDefaultTimeout(Number(process.env.TRANSLATE_TEST_TIMEOUT_MS || 30000));
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror',error => errors.push(error.message));
    let shardRequests = 0;
    context.on('request',req => {if(req.url().endsWith('.ndjson.gz')) shardRequests++;});
    await page.goto(base+'sample1.html');
    await page.waitForFunction(()=>!document.getElementById('query').disabled);
    await page.waitForFunction(()=>document.getElementById('shell-status').textContent.includes('ready offline'));
    assert.match(await page.locator('.identity').innerText(),/DB7957C93917F35A/);
    passed('Sample 1 initializes and service worker installs all sample shells');
    await page.evaluate(() => {
      const w = new Worker('dictionary-worker.js');
      let sequence = 0;
      const pending = new Map();
      window.testProgress = [];
      window.testCall = (method,args={}) => new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});w.postMessage({id,method,args});});
      w.onmessage=({data})=>{
        if(data.event){window.testProgress.push(data);return;}
        const p=pending.get(data.id);if(!p)return;pending.delete(data.id);data.error?p.reject(new Error(data.error)):p.resolve(data.result);
      };
    });
    const terms = {hu:'víz',en:'water',de:'Wasser',fr:'eau',es:'agua',it:'acqua',ru:'вода',ja:'水',la:'aqua'};
    let tested = 0;
    for (const from of Object.keys(terms)) for (const to of Object.keys(terms)) {
      if(from===to)continue;
      const result = await page.evaluate(async({from,to,query})=>{
        let offset=0,found=false,pages=0;
        do {
          const response=await window.testCall('search',{from,to,query,offset});
          found ||= response.results.some(s=>s.id==='wn:14845743-n' && s.words[to]?.length);
          offset=response.next;pages++;
        } while(!found && offset!==null && pages<100);
        return {found,pages};
      },{from,to,query:terms[from]});
      assert(result.found,from+' → '+to+' must contain the attested water sense');
      tested++;
    }
    assert.equal(tested,72);
    passed('All 72 directed pairs return the actual common water sense, including pagination');
    let result = await page.evaluate(()=>window.testCall('search',{from:'hu',to:'en',query:'vi\u0301z'}));
    assert(result.results.some(s=>s.words.en.some(([word])=>word==='water')));
    const latin = await page.evaluate(()=>window.testCall('search',{from:'la',to:'en',query:'Antare\u0304s'}));
    assert(latin.results.some(s=>s.words.en.some(([word])=>word==='Antares')));
    passed('NFC/NFD Hungarian and Latin macrons match; Cyrillic and Japanese returned in pair tests');
    const words = await page.evaluate(()=>window.testCall('suggest',{lang:'hu',query:'ví'}));
    assert(words.length && words.length<=8 && words.some(w=>w.toLowerCase().startsWith('ví')));
    passed('Indexed Unicode prefix suggestions return at most eight real forms');
    const before=shardRequests;
    await page.evaluate(()=>window.testCall('search',{from:'hu',to:'en',query:'víz'}));
    await page.evaluate(()=>window.testCall('search',{from:'hu',to:'en',query:'víz'}));
    assert.equal(shardRequests,before);
    passed('Repeated cached lookup causes no dictionary network requests');
    const dataRoot=path.join(__dirname,'../data');
    const meta=JSON.parse(fs.readFileSync(path.join(dataRoot,'manifest.json'),'utf8'));
    let longForm;
    for(const shard of meta.languages.de.shards){
      const rows=zlib.gunzipSync(fs.readFileSync(path.join(dataRoot,shard.path))).toString('utf8').trimEnd().split('\n').map(JSON.parse);
      longForm=rows.find(r=>r.norm.length>250);if(longForm)break;
    }
    assert(longForm);
    const targetBit=longForm.masks[0];
    const target=meta.targetLanguages.find((lang,i)=>lang!=='de' && (targetBit & (1<<i)));
    const longResult=await page.evaluate(args=>window.testCall('search',args),{from:'de',to:target,query:longForm.forms[0]});
    assert(longResult.results.length);
    assert(Number(await page.locator('#query').getAttribute('maxlength'))>=longForm.forms[0].length);
    passed('Complete long translation phrases remain searchable in reverse lookup');
    await page.locator('#query').fill('ví');
    await page.locator('#suggestions').waitFor({state:'visible'});
    await page.locator('#query').press('ArrowDown');
    assert(await page.evaluate(()=>document.activeElement.closest('#suggestions')!==null));
    await page.keyboard.press('Escape');
    assert(await page.locator('#suggestions').isHidden());
    passed('Suggestion list opens, supports keyboard focus and dismisses with Escape');
    await page.locator('#query').fill('víz');await page.locator('#search').click();
    await page.waitForFunction(()=>document.getElementById('status').textContent.includes('shown'));
    assert.match(await page.locator('#results').innerText(),/water/);
    await page.locator('#favorite').click();assert.match(await page.locator('#favorite').innerText(),/Saved/);
    await page.locator('#favorites-tab').click();assert.match(await page.locator('#library-list').innerText(),/víz/);
    await page.locator('#copy').click();assert.match(await page.evaluate(()=>navigator.clipboard.readText()),/water/);
    const downloadPromise=page.waitForEvent('download');await page.locator('#export').click();
    const exported=await downloadPromise;
    assert.match(exported.suggestedFilename(),/^UnicodeTranslate_DB7957C93917F35A_\d{13}\.json$/);
    const payload=JSON.parse(fs.readFileSync(await exported.path(),'utf8'));
    assert.equal(payload.programId,'DB7957C93917F35A');assert(Number.isInteger(payload.timestamp));
    assert(payload.favorites.some(x=>x.query==='víz'));assert(payload.attribution.pwn);
    passed('UI search, favorites, history, clipboard and attributed timestamped export');
    const second=await context.newPage();await second.goto(base+'sample2.html');
    await second.waitForFunction(()=>!document.getElementById('query').disabled);
    assert.match(await second.locator('.identity').innerText(),/037C9B3921A9181C/);
    await second.locator('#favorites-tab').click();assert(!((await second.locator('#library-list').innerText()).includes('víz')));
    const third=await context.newPage();await third.goto(base+'sample3.html');
    await third.waitForFunction(()=>!document.getElementById('query').disabled);
    assert.match(await third.locator('.identity').innerText(),/B3B9220C1EE85E6B/);
    const stored=await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('unicode-translate:')));
    for(const key of ['0139F7C1BEDD4AA4','26861D16A601BA81','EF9C90D7C385F654'])assert(stored.some(x=>x.includes(key)));
    passed('All three samples run the same engine with independent Storage Key settings');
    await second.close();await third.close();
    await page.locator('#swap').click();assert.equal(await page.locator('#from').inputValue(),'en');assert.equal(await page.locator('#to').inputValue(),'hu');
    await page.locator('#clear').click();assert.equal(await page.locator('#query').inputValue(),'');
    passed('Language swap and clear controls');
    await page.evaluate(()=>{window.partialDownload=window.testCall('download',{lang:'hu'});});
    await page.waitForFunction(()=>window.testProgress.length>=5);
    await page.evaluate(()=>window.testCall('cancel'));
    const partial=await page.evaluate(()=>window.partialDownload);
    assert(partial.cancelled);
    const snapshot=await page.evaluate(()=>window.testCall('status'));
    assert(snapshot.languages.hu.done>0 && snapshot.languages.hu.done<snapshot.languages.hu.total);
    passed('Paused source download keeps committed chunks and does not claim completeness');
    const snapshotBefore=await page.evaluate(()=>window.testCall('status'));
    await page.evaluate(()=>{window.latinDownload=window.testCall('download',{lang:'la'});});
    await page.waitForFunction(()=>window.testProgress.some(x=>x.lang==='la'&&x.done===x.total),{},{timeout:180000});
    assert.equal((await page.evaluate(()=>window.latinDownload)).cancelled,false);
    const complete=await page.evaluate(()=>window.testCall('status'));
    assert.equal(complete.languages.la.done,complete.languages.la.total);
    const repeatBefore=shardRequests;
    await page.evaluate(()=>window.testCall('download',{lang:'la'}));assert.equal(shardRequests,repeatBefore);
    report.offlineLatin={chunks:complete.languages.la.total,compressedBytes:complete.languages.la.totalBytes,sharedChunksBefore:snapshotBefore.languages.la.done};
    passed('Full Latin offline download completes, reuses existing chunks and repeats without transfer');
    // Switch the actual UI to Latin before going offline. The new worker after reload
    // must read its dictionary from IndexedDB and shell files from CacheStorage.
    await page.locator('#from').selectOption('la');await page.locator('#to').selectOption('ja');
    await context.setOffline(true);await page.reload();
    await page.waitForFunction(()=>!document.getElementById('query').disabled);
    await page.locator('#query').fill('aqua');await page.locator('#search').click();
    await page.waitForFunction(()=>document.getElementById('status').textContent.includes('shown'));
    assert.match(await page.locator('#results').innerText(),/水/);
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:'/tmp/unicode-translate-mobile.png',fullPage:true});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
    await page.setViewportSize({width:1365,height:950});await page.screenshot({path:'/tmp/unicode-translate-desktop.png',fullPage:true});
    passed('Offline reload and Latin → Japanese dictionary lookup; mobile and desktop layouts fit viewport');
    // The shell for another sample was cached during the first install.
    await page.goto(base+'sample3.html');await page.waitForFunction(()=>!document.getElementById('query').disabled);
    passed('A different sample launches fully offline from the shared application shell');
    assert.deepEqual(errors,[]);
    passed('No uncaught browser application errors');
    await context.setOffline(false);
    await context.close();
    // A new isolated profile has no lexical data; corrupt network content must be
    // rejected before any completion marker can be written.
    const bad=await browser.newContext({serviceWorkers:'block'});
    await bad.route('**/*.ndjson.gz',route=>route.fulfill({status:200,contentType:'application/gzip',body:'corrupt'}));
    const badPage=await bad.newPage();await badPage.goto(base+'sample1.html');
    await badPage.waitForFunction(()=>!document.getElementById('query').disabled);
    await badPage.locator('#query').fill('víz');await badPage.locator('#search').click();
    await badPage.waitForFunction(()=>document.getElementById('status').classList.contains('error'));
    assert.match(await badPage.locator('#status').innerText(),/wrong size|integrity/);
    passed('Corrupt dictionary response is rejected without installing a shard');
    await bad.close();
  } finally {await browser.close();}
  report.completedAt=new Date().toISOString();
  fs.writeFileSync(path.join(__dirname,'browser-results.json'),JSON.stringify(report,null,2)+'\n');
})().catch(error=>{console.error(error);process.exitCode=1;});
