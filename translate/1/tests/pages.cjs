/* Verify the deployed GitHub Pages bytes and all three live program entry points. */
'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname,'..');
const base = process.env.TRANSLATE_TEST_URL || 'https://ae6820dc.github.io/9062/translate/1/';
const report = {baseUrl:base,commit:process.env.GITHUB_SHA || null,startedAt:new Date().toISOString(),files:[],samples:[]};
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const identities = [
  ['F78A948596C4566E','2FDB6E6E43A907F3'],
  ['F825FE966F8B494F','E66887A1A48670D9'],
  ['D50C935F9D572B7F','700603AD2F340E2A']
];
(async () => {
  assert.equal(new URL(base).pathname.endsWith('/translate/1/'),true,'Test the final /translate/1/ location');
  // Wait for deployment propagation, requiring the expected file bytes rather
  // than accepting any HTTP 200 or a previous deployment's application shell.
  const critical = ['index.html','sample1.html','sample2.html','sample3.html','readme.html',
    'app.js','styles.css','dictionary-worker.js','sw.js','documentation.js','icon.svg','LICENSE.txt','data/manifest.json'];
  const deadline = Date.now() + Number(process.env.PAGES_WAIT_MS || 900000);
  let lastError;
  while (Date.now() < deadline) {
    report.files = [];
    try {
      for (const file of critical) {
        const url = new URL(file,base); url.searchParams.set('verify',process.env.GITHUB_SHA || 'relocation');
        const response = await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(25000)});
        assert.equal(response.status,200,file+' HTTP status');
        const digest = sha(Buffer.from(await response.arrayBuffer()));
        assert.equal(digest,sha(fs.readFileSync(path.join(root,file))),file+' deployed SHA-256');
        report.files.push({file,status:response.status,sha256:digest});
      }
      lastError = null; break;
    } catch(error) {
      lastError = error;
      console.log('Waiting for expected Pages deployment:',error.message.split('\n')[0]);
      await new Promise(resolve=>setTimeout(resolve,15000));
    }
  }
  if(lastError) throw lastError;
  assert.equal(report.files.length,critical.length);
  console.log('PASS GitHub Pages serves all expected application files and the unchanged dictionary manifest');
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox']});
  try {
    const context = await browser.newContext({viewport:{width:1365,height:950}});
    context.setDefaultTimeout(120000);
    for(let i=1;i<=3;i++) {
      const page = await context.newPage(),errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      const response = await page.goto(base+`sample${i}.html`);
      assert.equal(response.status(),200);
      await page.waitForFunction(()=>!document.getElementById('query').disabled);
      await page.waitForFunction(()=>document.getElementById('shell-status').textContent.includes('ready offline'));
      const programId = await page.locator('meta[name="program-id"]').getAttribute('content');
      const storageKey = await page.locator('meta[name="storage-key"]').getAttribute('content');
      assert.equal(programId,identities[i-1][0]);assert.equal(storageKey,identities[i-1][1]);
      assert.match(await page.locator('.identity').innerText(),new RegExp(programId));
      await page.locator('#query').fill('víz');await page.locator('#search').click();
      await page.waitForFunction(()=>document.getElementById('status').textContent.includes('shown'));
      assert.match(await page.locator('#results').innerText(),/water/);
      await page.screenshot({path:path.join(__dirname,`pages-sample${i}-desktop.png`),fullPage:true});
      await page.setViewportSize({width:390,height:844});
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await page.screenshot({path:path.join(__dirname,`pages-sample${i}-mobile.png`),fullPage:true});
      assert.deepEqual(errors,[]);
      report.samples.push({url:page.url(),programId,storageKey,lookup:'víz → water',desktop:true,mobile:true,errors});
      console.log(`PASS published sample${i}.html: identity, dictionary lookup, offline shell, desktop and mobile`);
      await page.close();
    }
    await context.close();
  } finally {await browser.close();}
  const integration = spawnSync(process.execPath,[path.join(__dirname,'browser.cjs')],{
    env:{...process.env,TRANSLATE_TEST_URL:base,TRANSLATE_TEST_TIMEOUT_MS:'120000'},stdio:'inherit',timeout:600000
  });
  if(integration.error) throw integration.error;
  assert.equal(integration.status,0,'Complete browser integration suite must pass on the actual Pages origin');
  report.integration = JSON.parse(fs.readFileSync(path.join(__dirname,'browser-results.json'),'utf8'));
  report.success = true;
})().catch(error=>{report.success=false;report.error=error.stack;console.error(error);process.exitCode=1;})
.finally(()=>{report.completedAt=new Date().toISOString();fs.writeFileSync(path.join(__dirname,'pages-results.json'),JSON.stringify(report,null,2)+'\n');});
