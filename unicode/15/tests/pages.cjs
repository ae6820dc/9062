// Verify actual GitHub Pages responses and runtime behavior; no backend or injected application data.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const base=(process.env.PAGES_BASE_URL||'https://ae6820dc.github.io/9062/unicode/15/').replace(/\/?$/,'/');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function published(file){
 const expected=hash(fs.readFileSync(path.join(root,file)));
 const attempts=Number(process.env.PAGES_ATTEMPTS||40);
 for(let attempt=1;attempt<=attempts;attempt++){
  try{const response=await fetch(base+file+'?verify='+expected.slice(0,16),{signal:AbortSignal.timeout(20000)});if(response.ok&&hash(Buffer.from(await response.arrayBuffer()))===expected)return expected;
   console.log('Waiting for matching Pages content:',file,'attempt',attempt,'HTTP',response.status);
  }catch(e){console.log('Waiting for Pages:',file,e.message)}
  if(attempt<attempts)await new Promise(resolve=>setTimeout(resolve,15000));
 }
 throw new Error('GitHub Pages did not serve the exact committed file: '+base+file);
}
(async()=>{
 const files={};for(const file of ['sample1.html','sample2.html','sample3.html','readme.html','data/manifest.json','data/cldr-manifest.json'])files[file]=await published(file);
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||chromium.executablePath(),headless:true,args:['--no-sandbox']});
 const cases=[],errors=[];
 for(let n=1;n<=3;n++)for(const [width,height] of [[1440,1000],[390,844],[320,568]]){
  const mobile=width<1000,context=await browser.newContext({viewport:{width,height},isMobile:mobile,hasTouch:mobile,...(mobile?{userAgent:'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36'}:{})});
  try{
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   const response=await page.goto(base+`sample${n}.html`,{waitUntil:'networkidle'});assert.equal(response.status(),200);
   assert.equal(await page.locator('#set option').count(),582);
   const before=await page.textContent('#counter');await page.click('#next');assert.notEqual(await page.textContent('#counter'),before);await page.click('#prev');assert.equal(await page.textContent('#counter').then(s=>s.split(' · ')[0]),before.split(' · ')[0]);
   async function jump(mode,value,global=false){await page.click('#jumpButton');await page.check(`[name="jumpMode"][value="${mode}"]`);await page.locator('#globalSearch').setChecked(global);await page.fill('#jumpInput',value);await page.click('#jumpGo')}
   await page.selectOption('#set','vi');await jump('unicode','U+1EAE');await page.selectOption('#normal','NFD');assert.equal(await page.textContent('#codepoint'),'U+0041 U+0306 U+0301');await page.selectOption('#normal','Original');
   await page.selectOption('#set','en');await jump('unicode','U+1F600',true);assert.equal(await page.inputValue('#set'),'unicode');assert.equal(await page.textContent('#glyph'),'😀');
   await jump('sequence','U+1F469 U+200D U+1F680');assert.equal(await page.textContent('#codepoint'),'U+1F469 U+200D U+1F680');assert((await page.textContent('#details')).includes('1 grafémaklaszter'));
   await jump('sequence','i');await page.selectOption('#locale','tr');await page.selectOption('#case','upper');assert.equal(await page.textContent('#glyph'),'İ');await page.selectOption('#case','original');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.selectOption('#set','hu');await jump('position','5');const saved=await page.textContent('#codepoint');await page.reload();assert.equal(await page.textContent('#codepoint'),saved);
   await page.fill('#speed','0.05');await page.click('#start');const old=await page.textContent('#counter');await page.waitForTimeout(200);assert.notEqual(await page.textContent('#counter'),old);await page.click('#start');
   if(!mobile){await page.click('#fullscreen');await page.waitForFunction(()=>!!document.fullscreenElement);await page.evaluate(()=>document.exitFullscreen())}
   await page.screenshot({path:path.join(root,'tests',`pages-sample${n}-${width}.png`),fullPage:true});cases.push({url:base+`sample${n}.html`,width,height,status:'passed'});console.log('PASS',base+`sample${n}.html`,width,height);
  }finally{await context.close()}
 }
 await browser.close();assert.deepEqual(errors,[]);
 const result={base,commit:process.env.GITHUB_SHA||null,verifiedAt:new Date().toISOString(),files,cases,errors,deviceTesting:'Desktop Chromium and Android-sized Chromium emulation; not physical devices'};
 fs.writeFileSync(path.join(root,'tests/pages-results.json'),JSON.stringify(result,null,2)+'\n');
 console.log('PASS: exact published files and all nine GitHub Pages browser cases');
 if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,'## Unicode v15 GitHub Pages verification\n\nAll three samples passed desktop and Android-sized Chromium checks. Published HTML and source manifests match the checked-out files byte-for-byte.\n\n'+cases.map(c=>`- [${c.url}](${c.url}) — ${c.width}×${c.height}: passed`).join('\n')+'\n');
})().catch(e=>{console.error(e);process.exitCode=1});
