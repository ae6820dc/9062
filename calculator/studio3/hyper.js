'use strict';
function saveResultHTML(title, text, program){
 const stamp=Date.now(),escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const html='<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+escape(title)+'</title><style>body{font:18px system-ui;max-width:960px;margin:32px auto;padding:20px;background:#101827;color:#eef4ff}pre{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.6}</style><h1>'+escape(title)+'</h1><p>Program ID: '+escape(program)+'</p><p>Timestamp: '+stamp+' · '+new Date(stamp).toISOString()+'</p><pre>'+escape(text)+'</pre></html>';
 const url=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='Mathematics-Studio-'+program+'-'+stamp+'.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function installHyperKeyboard(doc){
 if(!doc?.body||doc.getElementById('hyper-keyboard'))return;
 const style=doc.createElement('style');style.textContent='#hyper-keyboard{background:#17283c;border:1px solid #609bad;border-radius:14px;padding:12px;margin:12px 0;position:relative;box-sizing:border-box;width:100%;max-width:100%;min-width:0}#hyper-keyboard .hyper-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px;margin-top:6px}#hyper-keyboard .hyper-controls{grid-template-columns:repeat(4,minmax(0,1fr))}#hyper-keyboard .hyper-controls button[data-wide]{grid-column:span 2}#hyper-keyboard details .hyper-grid{grid-template-columns:repeat(4,minmax(0,1fr))}#hyper-keyboard button{padding:10px 2px;min-height:44px;min-width:0;font-size:15px;line-height:1.3;box-sizing:border-box;width:100%;max-width:100%;white-space:normal;overflow-wrap:anywhere;touch-action:manipulation}#hyper-keyboard p{font-size:13px;margin:4px 0 10px}#hyper-keyboard summary{cursor:pointer;padding:10px}input[readonly],textarea[readonly]{cursor:pointer}';
 doc.head.append(style);
 const panel=doc.createElement('section');panel.id='hyper-keyboard';panel.hidden=true;panel.setAttribute('aria-label','Hyper keyboard');
 const label=doc.createElement('p');panel.append(label);
 let active=null;
 const allFields=()=>Array.from(doc.querySelectorAll('input:not([type=file]):not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button]):not([type=submit]),textarea'));
 function edit(token){
  if(!active?.isConnected)return;
  const start=active.selectionStart??active.value.length,end=active.selectionEnd??start;
  let a=start,b=end,t=token;
  if(token==='Clear'){a=0;b=active.value.length;t='';}
  if(token==='⌫'){a=start===end?Math.max(0,start-1):start;t='';}
  if(token==='←'||token==='→'){const p=Math.max(0,Math.min(active.value.length,token==='←'?start-1:end+1));active.setSelectionRange(p,p);return;}
  if(token==='Next'){const f=allFields();f[(f.indexOf(active)+1)%f.length]?.focus();return;}
  if(token==='Space')t=' ';
  if(token==='New row')t=active.tagName==='TEXTAREA'?'\n':';';
  if(token==='Calculate'){if(doc===document&&active.closest('#percent-form'))doc.getElementById('percent-form').requestSubmit();else doc.getElementById('calculate')?.click();return;}
  if(active.value.length-(b-a)+t.length>50000)return;
  active.setRangeText(t,a,b,'end');active.dispatchEvent(new doc.defaultView.Event('input',{bubbles:true}));active.dispatchEvent(new doc.defaultView.Event('change',{bubbles:true}));
 }
 function grid(keys,parent){const g=doc.createElement('div');g.className='hyper-grid'+(keys.includes('Clear')?' hyper-controls':'');for(const k of keys){const b=doc.createElement('button');b.type='button';b.textContent=k;if(['Next','Calculate','Space','New row'].includes(k))b.dataset.wide='true';b.onpointerdown=e=>{e.preventDefault();active?.blur();};b.onclick=()=>edit(k);g.append(b);}parent.append(g);}
 grid(['7','8','9','+','(',')','4','5','6','-','^','/','1','2','3','*','x','y','0','. ',',',';','pi','e'].map(x=>x.trim()),panel);
 grid(['Clear','⌫','←','→','Next','Calculate','Space','New row'],panel);
 const more=doc.createElement('details'),summary=doc.createElement('summary');summary.textContent='Functions & letters';more.append(summary);grid(['sin(','cos(','tan(','sqrt(','abs(','log(','log10(','exp(','asin(','acos(','atan(','cbrt(','sinh(','cosh(','tanh(','sign('],more);grid('abcdefghijklmnopqrstuvwxyz'.split(''),more);panel.append(more);doc.body.append(panel);
 function prepare(){for(const input of allFields()){if(input.type==='number')input.type='text';input.readOnly=true;input.inputMode='none';input.autocomplete='off';}
  for(const id of (doc===document?[]:['export','export-json','export-html'])){const e=doc.getElementById(id);if(e)e.hidden=true;}
  const imp=doc.getElementById('import');if(imp)imp.closest('label').hidden=true;
  const download=doc.getElementById('download-result');
  if(download){if(download.textContent!=='Save HTML')download.textContent='Save HTML';download.onclick=()=>{const result=doc.getElementById('result');if(!result||result.hidden)return;const inputs=allFields().filter(e=>!e.closest('#hyper-keyboard')).map(e=>(e.name||e.id)+': '+e.value).join('\n');saveResultHTML(doc.title,inputs+'\n\n'+result.innerText,doc.getElementById('program')?.textContent||PROGRAM);};}
 }
 doc.addEventListener('focusin',e=>{if(!allFields().includes(e.target)||(doc===document&&e.target.id==='expression'))return;if(active===e.target&&panel.isConnected&&!panel.hidden)return;active=e.target;label.textContent='Hyper keyboard · '+(active.labels?.[0]?.childNodes[0]?.textContent?.trim()||active.name||active.id);panel.hidden=false;const anchor=active.closest('label')||active;anchor.after(panel);});
 const observer=new doc.defaultView.MutationObserver(prepare);observer.observe(doc.body,{childList:true,subtree:true});prepare();
}
document.getElementById('lab-frame').addEventListener('load',()=>{try{installHyperKeyboard(document.getElementById('lab-frame').contentDocument);}catch{}});
installHyperKeyboard(document);
