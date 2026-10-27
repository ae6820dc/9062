// Regression for description length changing page height / scroll position.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const base=(process.env.VIEWER_BASE_URL||'http://127.0.0.1:8765/unicode/15/').replace(/\/?$/,'/');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':chromium.executablePath()),headless:true,args:['--no-sandbox']});
 let cases=0,playbackFrames=0;const errors=[];
 try{
 for(let sample=1;sample<=3;sample++)for(const [width,height] of [[320,568],[390,844],[568,320],[768,1024],[1440,1000]]){
  const context=await browser.newContext({viewport:{width,height},isMobile:width<1000,hasTouch:width<1000});
  try{
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base+`sample${sample}.html`);
   const staticChecks=await page.evaluate(()=>{
    $('set').value='unicode';sequence=null;index=pool().indexOf(0x41);display();
    const panel=$('details'),screen=$('screen'),footer=panel.nextElementSibling;
    const metrics=()=>{const p=panel.getBoundingClientRect(),s=screen.getBoundingClientRect();return [p.width,p.height,p.top+scrollY,s.top+scrollY,footer.getBoundingClientRect().top+scrollY,document.documentElement.scrollHeight,scrollY]};
    window.scrollTo(0,document.documentElement.scrollHeight);const expected=metrics();
    const longest=UnicodeViewer.D.names.filter(n=>n[0]===n[1]).sort((a,b)=>b[2].length-a[2].length)[0];
    const inputs=['A',String.fromCodePoint(longest[0]),'\u0301','a\u0301\u0323','\u{1F600}','\u{20000}','👩\u200D🚀',('a\u0301\u0323\uFE0F👩\u200D🚀').repeat(60)];
    let overflowing=false;
    for(const text of inputs){
     sequence=text;display();const now=metrics();
     if(now.some((n,i)=>Math.abs(n-expected[i])>.1))throw Error('Description changed outer layout: '+JSON.stringify({expected,now}));
     if(panel.textContent.indexOf(UnicodeViewer.label(text))<0)throw Error('Original code point information lost');
     if(panel.scrollWidth>panel.clientWidth+1||document.documentElement.scrollWidth>innerWidth)throw Error('Horizontal overflow');
     if(panel.scrollHeight>panel.clientHeight){overflowing=true;const y=scrollY;panel.scrollTop=panel.scrollHeight;if(panel.scrollTop<=0||scrollY!==y)throw Error('Internal scroll failed')}
    }
    if(!overflowing)throw Error('Long description did not overflow internally');
    sequence=null;index=pool().indexOf(0x41);display();
    if(panel.scrollHeight>panel.clientHeight&&innerWidth===1440)throw Error('Short description unexpectedly overflows desktop panel');
    return {height:expected[1],inputs:inputs.length};
   });
   assert.equal(staticChecks.height,160);
   // Actual asynchronous timer advances through short/long official names and supplementary scalars.
   const frames=await page.evaluate(async()=>{
    const panel=$('details');$('set').value='unicode';sequence=null;index=pool().indexOf(0x1FBA0);display();
    window.scrollTo(0,document.documentElement.scrollHeight);const rect=panel.getBoundingClientRect();
    const expected={width:rect.width,height:rect.height,top:rect.top+scrollY,page:document.documentElement.scrollHeight,y:scrollY};
    $('speed').value='.05';start();let n=0;
    try{for(let i=0;i<15;i++){await new Promise(r=>setTimeout(r,60));const p=panel.getBoundingClientRect();if(Math.abs(p.width-expected.width)>.1||p.height!==expected.height||Math.abs(p.top+scrollY-expected.top)>.1||document.documentElement.scrollHeight!==expected.page||scrollY!==expected.y)throw Error('Playback moved page or resized panel');n++}}finally{stop()}
    if(count<10)throw Error('Playback did not advance');return n;
   });
   cases++;playbackFrames+=frames;console.log('PASS description panel:',sample,width,height,staticChecks.inputs,'short/long cases;',frames,'playback checks');
  }finally{await context.close()}
 }
 assert.deepEqual(errors,[]);console.log('PASS',cases,'viewports;',playbackFrames,'playback frames; fixed 160px outer height; internal scrolling only');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
