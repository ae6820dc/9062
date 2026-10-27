const $=id=>document.getElementById(id);
for(const [kind,title] of [['language','Válogatott nyelvi leltárak'],['assigned','Kiosztott Unicode'],['property','Tulajdonsággyűjtemények'],['script','Írásrendszerek (nem nyelvek)'],['category','Általános kategóriák'],['block','Teljes skalárblokkok (nem nyelvek)']]){
 const group=document.createElement('optgroup');group.label=title;
 for(const c of D.collections.filter(c=>c.kind===kind)){const o=document.createElement('option');o.value=c.id;o.textContent=c.label+' ('+c.count.toLocaleString('hu-HU')+')';group.append(o)}$('set').append(group);
}
let timer=null,count=0,positions={},index=0,sequence=null;
const pool=()=>inventories.get($('set').value);
function save(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify({set:$('set').value,speed:$('speed').value,positions,index,count,normal:$('normal').value,case:$('case').value,locale:$('locale').value}))}catch{$('status').textContent='A helyi mentés nem elérhető.'}}
function fitGlyph(){
 const screen=$('screen'),glyph=$('glyph');
 const availableW=Math.max(20,screen.clientWidth-96);
 const availableH=Math.max(12,screen.clientHeight-36);
 const canvas=fitGlyph.canvas||(fitGlyph.canvas=document.createElement('canvas')),ctx=canvas.getContext('2d');
 const family=getComputedStyle(glyph).fontFamily;
 let size=Math.min(220,availableH/1.5,availableW/2.1);
 for(let n=0;n<24;n++){
  const px=Math.max(1,Math.floor(size));glyph.style.fontSize=px+'px';ctx.font=px+'px '+family;
  const m=ctx.measureText(glyph.textContent),inkW=(m.actualBoundingBoxLeft||0)+(m.actualBoundingBoxRight||0),inkH=(m.actualBoundingBoxAscent||0)+(m.actualBoundingBoxDescent||0);
  const w=Math.max(glyph.scrollWidth,inkW*1.18),h=Math.max(glyph.scrollHeight,inkH*1.35);
  if(w<=availableW&&h<=availableH)break;
  size*=Math.min(.9,availableW/Math.max(1,w),availableH/Math.max(1,h));
 }
}
function display(){const p=pool();index=((index%p.length)+p.length)%p.length;const original=sequence||p.at(index),mapped=caseMap(original,$('case').value,$('locale').value),shown=normalize(mapped,$('normal').value);
 $('glyph').textContent=shown;$('codepointBox').classList.toggle('sequence',points(shown).length>1);$('codepoint').textContent=label(shown)||'∅ (üres sorozat)';fitGlyph();
 $('poolCount').textContent='Különböző kódpontbejegyzések száma: '+p.length.toLocaleString('hu-HU')+' · '+p.c.coverage;
 $('counter').textContent=(index+1).toLocaleString('hu-HU')+' / '+p.length.toLocaleString('hu-HU')+' · Lépések: '+count.toLocaleString('hu-HU');
 $('details').textContent=(sequence?'Egyedi sorozat; a készletet nem módosítja. ':'')+'Eredeti: '+label(original)+' · '+points(original).map(characterName).join('; ')+' | Megjelenítés: '+points(shown).length+' skalár, '+shown.length+' UTF-16 kódegység, '+graphemes(shown).length+' grafémaklaszter (UCD '+D.version+'). A láthatatlan jelek is valódi bejegyzések.';
}
function stop(){if(timer!==null)clearInterval(timer);timer=null;$('start').textContent='▶ Indítás'}
function step(delta){sequence=null;index=(index+delta+pool().length)%pool().length;positions[$('set').value]=index;count++;display();save()}
function start(){if(timer!==null){stop();save();return}const seconds=Number($('speed').value);if(!Number.isFinite(seconds)||seconds<.05||seconds>3600){$('status').textContent='Az időköz 0,05 és 3600 másodperc között legyen.';return}timer=setInterval(()=>step(1),seconds*1000);$('start').textContent='⏸ Szünet';save()}
$('start').onclick=start;$('prev').onclick=()=>step(-1);$('next').onclick=()=>step(1);
$('set').onchange=()=>{const playing=timer!==null;stop();sequence=null;index=Number.isSafeInteger(positions[$('set').value])?positions[$('set').value]:0;display();save();if(playing)start()};
$('speed').onchange=()=>{const playing=timer!==null;stop();save();if(playing)start()};
for(const id of ['normal','case','locale'])$(id).onchange=()=>{display();save()};
let returnFocus=null;
function openJump(){returnFocus=document.activeElement;stop();save();$('jumpOverlay').classList.add('open');$('jumpError').textContent='';document.querySelector('[name="jumpMode"][value="position"]').checked=true;updateJumpMode();$('jumpInput').focus();$('jumpInput').select()}
function closeJump(){$('jumpOverlay').classList.remove('open');$('status').textContent='Szüneteltetve';returnFocus?.focus();save()}
function updateJumpMode(){const mode=document.querySelector('[name="jumpMode"]:checked').value;$('jumpLabel').firstChild.textContent=mode==='position'?'Karakter sorszáma':mode==='unicode'?'Unicode-kódpont (U+ vagy hex)':'Sorozat: U+0061 U+0301 vagy szöveg';$('jumpInput').inputMode=mode==='position'?'numeric':'text';$('jumpInput').value=mode==='position'?String(index+1):mode==='unicode'?label(pool().at(index)):'';$('jumpError').textContent=''}
function parseSequence(raw){if(/^(?:U\+[0-9a-f]{1,6})(?:\s+U\+[0-9a-f]{1,6})*$/i.test(raw)){const a=raw.split(/\s+/).map(s=>parseInt(s.slice(2),16));if(a.some(n=>n>0x10FFFF||n>=0xD800&&n<=0xDFFF))return null;return textOf(a)}if(!raw||points(raw).some(n=>n>=0xD800&&n<=0xDFFF))return null;return raw}
function performJump(){const raw=$('jumpInput').value.trim(),mode=document.querySelector('[name="jumpMode"]:checked').value;let target=-1,selected=$('set').value;
 if(mode==='sequence'){const s=parseSequence(raw);if(s===null){$('jumpError').textContent='Érvénytelen skalár vagy üres sorozat.';return}sequence=s;display();closeJump();return}
 if(mode==='position'&&/^\d+$/.test(raw)){const n=Number(raw);if(Number.isSafeInteger(n)&&n>=1&&n<=pool().length)target=n-1}
 if(mode==='unicode'){const hex=raw.replace(/^U\+/i,'');if(/^[0-9a-f]{1,6}$/i.test(hex)){const cp=parseInt(hex,16);if(cp<=0x10FFFF&&!(cp>=0xD800&&cp<=0xDFFF)){target=pool().indexOf(cp);if(target<0&&$('globalSearch').checked){selected='unicode';target=inventories.get(selected).indexOf(cp)}}}}
 if(target<0){$('jumpError').textContent='Nincs találat; a bejegyzés és a készlet változatlan.';return}
 $('set').value=selected;sequence=null;index=target;positions[selected]=index;display();closeJump();save();
}
$('jumpButton').onclick=openJump;$('jumpCancel').onclick=closeJump;$('jumpGo').onclick=performJump;
document.querySelectorAll('[name="jumpMode"]').forEach(r=>r.onchange=updateJumpMode);
$('jumpOverlay').onclick=e=>{if(e.target===$('jumpOverlay'))closeJump()};
document.addEventListener('keydown',e=>{if(!$('jumpOverlay').classList.contains('open'))return;if(e.key==='Escape'){e.preventDefault();closeJump()}if(e.key==='Enter'){e.preventDefault();performJump()}if(e.key==='Tab'){const nodes=[...$('jumpOverlay').querySelectorAll('input,button')],first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('viewer').requestFullscreen()}catch{$('status').textContent='A teljes képernyő nem támogatott ebben a böngészőben.'}};
window.addEventListener('resize',fitGlyph);document.addEventListener('fullscreenchange',()=>requestAnimationFrame(fitGlyph));
try{const s=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');if(s&&typeof s==='object'){if(inventories.has(s.set))$('set').value=s.set;const speed=Number(s.speed);if(Number.isFinite(speed)&&speed>=.05&&speed<=3600)$('speed').value=speed;if(s.positions&&typeof s.positions==='object'&&!Array.isArray(s.positions))positions=s.positions;if(Number.isSafeInteger(s.index)&&s.index>=0)index=s.index;if(Number.isSafeInteger(s.count)&&s.count>=0)count=s.count;for(const id of ['normal','case','locale'])if([...$(id).options].some(o=>o.value===s[id]))$(id).value=s[id]}}catch{}
display();save();
