// Additional touch-viewport coverage for every sample, including native scrolling.
const {chromium}=require('playwright');
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert/strict');
(async()=>{
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');try{res.end(fs.readFileSync(path.join(__dirname,path.basename(req.url))));}catch{res.statusCode=404;res.end();}}).listen(0,'127.0.0.1');
 await new Promise(resolve=>server.on('listening',resolve));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  for(let n=1;n<=22;n++){
   const context=await browser.newContext({viewport:{width:360,height:800},isMobile:true,hasTouch:true});
   const page=await context.newPage();
   await page.goto(`http://127.0.0.1:${server.address().port}/sample${n}.html`);
   await page.waitForFunction(()=>ready);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.locator('#folders').evaluate(el=>{el.scrollTop=el.scrollHeight;});
   await page.waitForFunction(()=>!!document.querySelector('[data-codepoint="40959"]'));
   assert(await page.locator('.folder').count()<100);
   await page.locator('[data-codepoint="40959"]').click();
   await page.waitForFunction(()=>path.length===1&&!busy);
   assert.equal(await page.locator('#address').inputValue(),'/鿿');
   await page.locator('#listView').click();
   await page.waitForFunction(()=>listMode&&!busy);
   await page.locator('#quick').fill('U+4E2D');
   await page.locator('#quickForm button').first().click();
   assert.equal(await page.evaluate(()=>document.activeElement.dataset.codepoint),'20013');
   await page.locator('#listStart').click();
   assert.equal(await page.evaluate(()=>document.activeElement.dataset.codepoint),'19968');
   await page.setViewportSize({width:800,height:360});
   await page.waitForTimeout(80);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   assert(await page.locator('.folder').count()<150);
   await context.close();
   console.log(`sample${n}: PASS 360px touch viewport, last-folder scroll/open, list search, list start, landscape resize`);
  }
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
