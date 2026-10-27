// Focused layout regression: preserve v14's single-code-point label size and fit sequence labels.
const {chromium}=require('playwright'),assert=require('assert/strict'),fs=require('fs'),path=require('path');
const R=path.resolve(__dirname,'..');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});const cases=[];
for(let sample=1;sample<=3;sample++)for(const [width,height] of [[1440,1000],[390,844],[320,568],[568,320],[844,390]]){
 const context=await browser.newContext({viewport:{width,height},isMobile:width<1000,hasTouch:width<1000}),page=await context.newPage();await page.goto(`http://127.0.0.1:8765/unicode/15/sample${sample}.html`);
 const result=await page.evaluate(()=>{const results=[];function check(){const s=$('screen').getBoundingClientRect(),c=$('codepoint').getBoundingClientRect(),g=$('glyph').getBoundingClientRect();if(c.top<s.top||c.bottom>g.top||c.left<s.left||c.right>s.right||g.top<s.top||g.bottom>s.bottom||document.documentElement.scrollWidth>innerWidth)throw Error('Layout overflow');results.push({label:$('codepoint').textContent,labelFont:parseFloat(getComputedStyle($('codepoint')).fontSize)})}
 $('set').value='unicode';index=pool().indexOf(0x1EAE);sequence=null;$('normal').value='Original';display();check();if(results[0].labelFont<32||results[0].labelFont>48)throw Error('Baseline label size changed');
 $('normal').value='NFD';display();check();if($('codepoint').textContent!=='U+0041 U+0306 U+0301')throw Error('NFD label');
 $('normal').value='Original';sequence='👩\u200D🚀';display();check();sequence='a\u0301\u0323\uFE0F';display();check();
 sequence=null;display();return results});
 await page.screenshot({path:R+`/tests/sample${sample}-${width}x${height}.png`,fullPage:true});cases.push({sample,width,height,checks:result});await context.close();
}
await browser.close();fs.writeFileSync(R+'/tests/layout-results.json',JSON.stringify({cases},null,2)+'\n');console.log('PASS',cases.length,'layout cases, 60 scalar/sequence geometry checks');})().catch(e=>{console.error(e);process.exit(1)});
