const {chromium}=require('playwright');
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert/strict');
(async()=>{
 const server=http.createServer((req,res)=>{try{res.setHeader('Content-Type','text/html;charset=utf-8');res.end(fs.readFileSync(path.join(__dirname,path.basename(req.url))));}catch{res.statusCode=404;res.end();}}).listen(0,'127.0.0.1');
 await new Promise(resolve=>server.on('listening',resolve));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{for(let n=1;n<=22;n++){
  const context=await browser.newContext({permissions:['clipboard-read','clipboard-write']});
  const page=await context.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/sample${n}.html`);await page.waitForFunction(()=>ready);
  await page.locator('#menuButton').click();await page.keyboard.press('End');assert.equal(await page.evaluate(()=>document.activeElement.dataset.action),'about');await page.keyboard.press('Enter');assert(await page.locator('#actionContent').innerText().then(t=>t.includes('U+4E00')));await page.locator('#cancelAction').click();
  await page.evaluate(()=>Object.defineProperty(navigator,'share',{value:undefined,configurable:true}));await page.locator('#menuButton').click();await page.locator('[data-action="share"]').click();assert.equal(await page.locator('#shareWebsiteUrl').inputValue(),page.url());await page.locator('#confirmAction').click();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),page.url());
  await page.locator('#menuButton').focus();await page.keyboard.press('Escape');await page.locator('#home').focus();await page.dispatchEvent('#home','keydown',{key:'中'});await page.waitForFunction(()=>path.length===1&&!busy);await page.locator('#copy').click();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'/中');
  await page.keyboard.press('Alt+ArrowUp');await page.waitForFunction(()=>path.length===0&&!busy);await page.keyboard.press('Alt+ArrowLeft');await page.waitForFunction(()=>path.length===1&&!busy);await page.keyboard.press('Alt+ArrowRight');await page.waitForFunction(()=>path.length===0&&!busy);
  await page.evaluate(()=>navigate(new Array(32).fill(0)));await page.waitForFunction(()=>path.length===32&&!busy);await page.locator('#crumbs [aria-label="Jump to level"]').click();await page.locator('#jumpLevel').fill('3');await page.locator('#confirmAction').click();await page.waitForFunction(()=>path.length===3&&!busy);
  await page.locator('#newFile').click();await page.locator('#fileName').fill('中');await page.locator('#fileForm button[type=submit]').click();assert(await page.locator('#fileError').innerText().then(t=>t.includes('already exists')));await page.locator('#cancelFile').click();
  await page.evaluate(()=>navigate(new Array(MAX_DEPTH).fill(0)));await page.waitForFunction(()=>path.length===65536&&!busy);await page.locator('#newFile').click();await page.locator('#fileName').fill('final.txt');await page.locator('#fileForm button[type=submit]').click();await page.waitForFunction(()=>currentFiles.length===1&&!busy);await page.locator('.file').click();assert(await page.locator('#toast').innerText().then(t=>t.includes('virtual file')));
  await page.locator('#menuButton').click();await page.locator('[data-action="new"]').click();await page.locator('#actionPassword').fill('wrong');await page.locator('#confirmAction').click();assert.equal(await page.evaluate(()=>path.length),65536);assert(await page.locator('#actionError').innerText().then(t=>t.includes('Incorrect')));await page.locator('#actionPassword').fill('1111');await page.locator('#confirmAction').click();await page.waitForFunction(()=>path.length===0&&!busy);assert.equal(await page.evaluate(()=>exportSave().then(s=>s.files.length)),0);
  await context.close();console.log(`sample${n}: PASS menu/keyboard, About, share/copy, earlier-level jump, folder-name conflict, terminal files, password guard/reset`);
 }}finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
