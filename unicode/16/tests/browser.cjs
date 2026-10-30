const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('fs');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium'});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
for(let sample=1;sample<=3;sample++){
 await page.goto('http://127.0.0.1:8765/unicode/16/sample'+sample+'.html');
 assert.deepEqual(await page.evaluate(()=>Array.from({length:9},(_,i)=>stringAt([65,66,67],2,BigInt(i+1)))),['AA','AB','AC','BA','BB','BC','CA','CB','CC']);
 await page.evaluate(()=>{chars.test=['C','A','B','A'];const o=document.createElement('option');o.value='test';$('set').append(o);$('set').value='test';$('length').value='2';$('ordinal').value='1';apply()});
 for(let n=1;n<=9;n++){await page.evaluate(n=>go(BigInt(n)),n);assert.equal(await page.locator('#glyph').textContent(),['AA','AB','AC','BA','BB','BC','CA','CB','CC'][n-1]);if(n>1){await page.evaluate(()=>step(-1n));await page.evaluate(()=>step(1n));assert.equal(await page.evaluate(()=>ordinal.toString()),String(n));}}
 await page.evaluate(()=>{start();step(1n)});assert.equal(await page.evaluate(()=>ordinal.toString()),'9');assert.equal(await page.evaluate(()=>timer),null);
 await page.evaluate(()=>{go(1n);step(-1n)});assert.equal(await page.evaluate(()=>ordinal.toString()),'1');
 await page.evaluate(()=>{$('set').value='unicode';$('length').value='128';$('ordinal').value='9007199254740993';apply()});
 assert.equal(await page.evaluate(()=>ordinal.toString()),'9007199254740993');
 assert.equal(await page.evaluate(()=>Array.from($('glyph').textContent).length),128);
 await page.evaluate(()=>step(1n));assert.equal(await page.evaluate(()=>ordinal.toString()),'9007199254740994');
 await page.evaluate(()=>{go(total);start()});assert.equal(await page.evaluate(()=>timer),null);
 assert.equal(await page.evaluate(()=>Array.from($('glyph').textContent).every(c=>c.codePointAt(0)===alphabet[alphabet.length-1])),true);
 assert.equal(await page.evaluate(()=>$('codepoint').textContent.split(' ').length),128);
 assert.equal(await page.evaluate(()=>stringAt([0x1f600,0x1f680],2,2n)),'😀🚀');
 for(const value of ['0','-1','1e3','1.5',' 2','abc']){await page.evaluate(v=>{$('ordinal').value=v;apply()},value);assert.ok(await page.locator('#error').textContent());}
 await page.evaluate(()=>{go(9007199254740993n);save()});await page.reload();assert.equal(await page.evaluate(()=>ordinal.toString()),'9007199254740993');assert.equal(await page.evaluate(()=>timer),null);
 for(const viewport of [{width:320,height:568},{width:1440,height:1000}]){await page.setViewportSize(viewport);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.equal(await page.locator('.codepoint').evaluate(e=>e.getBoundingClientRect().height),112)}
 await page.evaluate(()=>localStorage.setItem(STORAGE_KEY,JSON.stringify({version:16,set:'unicode',length:128,speed:'1',ordinal:'1e10'})));await page.reload();assert.equal(await page.evaluate(()=>ordinal),1n);assert.match(await page.locator('#error').textContent(),/mentett/);
 await page.evaluate(()=>{$('set').value='en';$('length').value='2';$('ordinal').value='10';apply();$('speed').value='0.05';start()});
 await page.waitForFunction(()=>ordinal>10n);await page.evaluate(()=>stop());
 await page.click('#jumpButton');await page.fill('#jumpInput','99');await page.click('#jumpGo');assert.equal(await page.evaluate(()=>ordinal.toString()),'99');
 await page.click('#fullscreen');await page.waitForFunction(()=>document.fullscreenElement!==null);await page.evaluate(()=>document.exitFullscreen());
 const before=await page.evaluate(()=>ordinal.toString());await page.evaluate(()=>{$('ordinal').value=(total+1n).toString();apply()});assert.equal(await page.evaluate(()=>ordinal.toString()),before);
 console.log('sample'+sample+': enumeration, boundaries, huge jumps, Unicode length 128, supplementary, validation, restore and layout passed');
}
const files=[1,2,3].map(n=>fs.readFileSync(__dirname+'/../sample'+n+'.html','utf8'));const ids=files.flatMap(s=>[s.match(/Program ID: ([A-F0-9]{16})/)[1],s.match(/STORAGE_KEY='([A-F0-9]{16})'/)[1]]);assert.equal(new Set(ids).size,6);assert.equal(new Set(files.map(s=>s.replace(/Program ID: [A-F0-9]{16}/,'Program ID: ID').replace(/STORAGE_KEY='[A-F0-9]{16}'/,"STORAGE_KEY='KEY'"))).size,1);assert.deepEqual(errors,[]);console.log('Unique identities, identical samples, zero browser errors passed');await browser.close()})().catch(e=>{console.error(e);process.exit(1)});
