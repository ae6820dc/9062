// Run: node explorer/9/tests/check.cjs (requires Playwright and Chromium).
const { chromium } = require('playwright');
const fs=require('fs'),assert=require('node:assert/strict'),http=require('http'),path=require('path');
const root=path.resolve(__dirname,'../../..');
const server=http.createServer((req,res)=>{const file=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(e,data)=>{res.writeHead(e?404:200,{'Content-Type':'text/html; charset=utf-8'});res.end(e?'Missing':data);});});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});const context=await browser.newContext();const ids=new Set();let template;
try{for(let i=1;i<=12;i++){
 const source=fs.readFileSync(path.join(root,`explorer/9/sample${i}.html`),'utf8');
 for(const id of [source.match(/Program ID: <code>([a-f0-9]{16})/)[1],source.match(/STORAGE_KEY='([a-f0-9]{16})'/)[1],source.match(/DATABASE_NAME='([a-f0-9]{16})'/)[1]]){assert(!ids.has(id));ids.add(id);}
 const normalized=source.replace(/[a-f0-9]{16}/g,'IDENTIFIER').replace(/sample\d+\.html/g,'sample.html');if(template)assert.equal(normalized,template);else template=normalized;
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/explorer/9/sample${i}.html`);await page.waitForFunction(()=>ready&&!busy);
 assert.equal(await page.title(),'German Explorer');assert(source.includes('Use up to 65536 folders'));assert.equal(await page.locator('.file').count(),0);
 assert.deepEqual(await page.locator('[data-symbol]').evaluateAll(es=>es.map(e=>e.dataset.symbol)),Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜß'));
 for(const c of ['Ä','Ö','Ü','ß']){await page.locator(`[data-symbol="${c}"]`).click();await page.waitForFunction(()=>!busy);}
 assert.equal(await page.locator('#address').inputValue(),'/Ä/Ö/Ü/ß');
 await page.locator('#back').click();await page.waitForFunction(()=>!busy);assert.equal(await page.locator('#address').inputValue(),'/Ä/Ö/Ü');
 await page.locator('#forward').click();await page.waitForFunction(()=>!busy);
 await page.locator('#newFile').click();await page.locator('#fileName').fill('Grüße.txt');await page.locator('#fileForm button[type=submit]').click();await page.waitForFunction(()=>!busy);assert.equal(await page.locator('.file').count(),1);
 await page.locator('#listView').click();await page.waitForFunction(()=>!busy);await page.reload();await page.waitForFunction(()=>ready&&!busy);assert.equal(await page.locator('#address').inputValue(),'/Ä/Ö/Ü/ß');assert.equal(await page.locator('.file').count(),1);assert(await page.locator('#folders').evaluate(e=>e.classList.contains('list')));
 await page.locator('#address').fill('/a/ä/ö/ü/ß');await page.locator('#address').press('Enter');await page.waitForFunction(()=>!busy);assert.equal(await page.locator('#address').inputValue(),'/A/Ä/Ö/Ü/ß');
 await page.locator('#newFile').click();await page.locator('#fileName').fill('ß');await page.locator('#fileForm button[type=submit]').click();assert.match(await page.locator('#fileError').innerText(),/already exists/);await page.locator('#cancelFile').click();
 await page.locator('#home').click();await page.waitForFunction(()=>!busy);await page.locator('body').dispatchEvent('keydown',{key:'ß',bubbles:true});await page.waitForFunction(()=>!busy);assert.equal(await page.locator('#address').inputValue(),'/ß');
 await page.evaluate(async()=>{await navigate(Array(65536).fill('ß'));});assert.equal(await page.locator('[data-symbol]').count(),0);assert.equal(await page.locator('#depth').innerText(),'65536');assert(await page.locator('#terminal').isVisible());assert(await page.locator('#crumbs button').count()<=26);
 await page.evaluate(async()=>{await enter('A');});assert.equal(await page.locator('#depth').innerText(),'65536');
 await page.reload();await page.waitForFunction(()=>ready&&!busy);assert.equal(await page.locator('#depth').innerText(),'65536');
 await page.locator('#terminalUp').click();await page.waitForFunction(()=>!busy);assert.equal(await page.locator('[data-symbol]').count(),30);
 await page.evaluate(async()=>{for(let j=0;j<40;j++){await up();}});assert.equal(await page.evaluate(()=>history.every(n=>n===null||(!Array.isArray(n)&&n.depth>=0))),true);
 await page.evaluate(()=>showAction('level'));await page.locator('#jumpLevel').fill('4');await page.locator('#confirmAction').click();await page.waitForFunction(()=>!busy);assert.equal(await page.locator('#address').inputValue(),'/ß/ß/ß/ß');
 await page.evaluate(()=>showAction('about'));assert.match(await page.locator('#actionContent').innerText(),/German Explorer/);await page.locator('#cancelAction').click();
 await page.evaluate(()=>showAction('share'));assert.match(await page.locator('#shareWebsiteUrl').inputValue(),new RegExp(`/explorer/9/sample${i}\\.html$`));await page.locator('#cancelAction').click();
 await page.evaluate(async()=>{await navigate(['Ä','Ö','Ü','ß']);});
 await page.evaluate(()=>showAction('delete'));await page.locator('#selectAllFiles').check();await page.locator('#actionPassword').fill('1111');await page.locator('#confirmAction').click();await page.waitForFunction(()=>!busy);assert.equal(await page.locator('.file').count(),0);
 await page.evaluate(()=>showAction('new'));await page.locator('#actionPassword').fill('1111');await page.locator('#confirmAction').click();await page.waitForFunction(()=>!busy);assert.equal(await page.locator('#address').inputValue(),'/');assert.equal(await page.evaluate(()=>databaseTask(['files'],'readonly',(tx,result)=>{const r=tx.objectStore('files').count();r.onsuccess=()=>result(r.result);})),0);
 await page.locator('#newFile').click();await page.locator('#fileName').fill('isolation-'+i+'.txt');await page.locator('#fileForm button[type=submit]').click();await page.waitForFunction(()=>!busy);
 assert.deepEqual(errors,[]);await page.close();
 const legacyContext=await browser.newContext();await legacyContext.addInitScript(({key})=>localStorage.setItem(key,JSON.stringify({path:['Ä','Ö','Ü','ß'],listMode:true,files:{'/Ä/Ö/Ü/ß':[{name:'Legacy Grüße.txt',created:1}]}})),{key:source.match(/STORAGE_KEY='([a-f0-9]{16})'/)[1]});const legacyPage=await legacyContext.newPage();await legacyPage.goto(`http://127.0.0.1:${server.address().port}/explorer/9/sample${i}.html`);await legacyPage.waitForFunction(()=>ready&&!busy);assert.equal(await legacyPage.locator('#address').inputValue(),'/Ä/Ö/Ü/ß');assert.equal(await legacyPage.locator('.file .folder-name').innerText(),'Legacy Grüße.txt');assert.equal(await legacyPage.evaluate(()=>localStorage.getItem(STORAGE_KEY)),null);await legacyContext.close();console.log(`sample${i}: PASS`);
 }console.log('12 samples passed; 36 unique identifiers; matching implementations.');}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
