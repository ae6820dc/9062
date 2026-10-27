'use strict';
// All normative character properties below come from the pinned UCD, not browser regexes.
const D=JSON.parse(document.getElementById('ucd').textContent);
const points=s=>Array.from(s,c=>c.codePointAt(0));
const textOf=a=>a.map(cp=>String.fromCodePoint(cp)).join('');
const label=s=>points(s).map(cp=>'U+'+cp.toString(16).toUpperCase().padStart(4,'0')).join(' ');
function inRanges(cp,rr){let lo=0,hi=rr.length-1;while(lo<=hi){const m=(lo+hi)>>>1,[a,b]=rr[m];if(cp<a)hi=m-1;else if(cp>b)lo=m+1;else return true}return false}
const prop=(cp,p)=>inRanges(cp,D.props[p]||[]);
class Inventory{
 constructor(c){this.c=c;this.ends=[];let n=0;for(const [a,b] of c.ranges)this.ends.push(n+=b-a+1);this.length=n}
 at(i){if(!Number.isSafeInteger(i)||i<0||i>=this.length)return undefined;let l=0,h=this.ends.length-1;while(l<h){const m=(l+h)>>>1;if(i<this.ends[m])h=m;else l=m+1}return String.fromCodePoint(this.c.ranges[l][0]+i-(l?this.ends[l-1]:0))}
 indexOf(cp){let l=0,h=this.c.ranges.length-1;while(l<=h){const m=(l+h)>>>1,[a,b]=this.c.ranges[m];if(cp<a)h=m-1;else if(cp>b)l=m+1;else return (m?this.ends[m-1]:0)+cp-a}return -1}
}
const inventories=new Map(D.collections.map(c=>[c.id,new Inventory(c)]));
function normalize(s,form){
 if(form==='Original')return s;
 const compat=form==='NFKC'||form==='NFKD',out=[];
 function expand(cp){
  if(cp>=0xAC00&&cp<=0xD7A3){const n=cp-0xAC00;out.push(0x1100+Math.floor(n/588),0x1161+Math.floor(n%588/28));if(n%28)out.push(0x11A7+n%28);return}
  const d=D.decomp[cp];if(d&&(compat||!compatSet.has(cp)))d.forEach(expand);else out.push(cp);
 }
 points(s).forEach(expand);
 for(let i=1;i<out.length;i++){let j=i;while(j>0&&(D.ccc[out[j]]||0)!==0&&(D.ccc[out[j-1]]||0)>(D.ccc[out[j]]||0)){[out[j-1],out[j]]=[out[j],out[j-1]];j--}}
 if(form==='NFD'||form==='NFKD')return textOf(out);
 const result=[];let starter=-1,last=0;
 for(const cp of out){const cc=D.ccc[cp]||0,a=result[starter];let composite;
  if(a>=0x1100&&a<=0x1112&&cp>=0x1161&&cp<=0x1175)composite=0xAC00+(a-0x1100)*588+(cp-0x1161)*28;
  else if(a>=0xAC00&&a<=0xD7A3&&(a-0xAC00)%28===0&&cp>=0x11A8&&cp<=0x11C2)composite=a+cp-0x11A7;
  else composite=D.compose[a+','+cp];
  if(composite!==undefined&&(last===0||last<cc)){result[starter]=composite;continue}
  if(cc===0)starter=result.length;result.push(cp);last=cc;
 }
 return textOf(result);
}
const compatSet=new Set(D.compat);
function caseMap(s,mode,locale='und'){
 if(mode==='original')return s;const a=points(s);
 function condition(cond,i){const cp=a[i];
  if(cond==='Final_Sigma'){let before=false;for(let j=i-1;j>=0;j--){if(prop(a[j],'Case_Ignorable'))continue;before=prop(a[j],'Cased');break}if(!before)return false;for(let j=i+1;j<a.length;j++){if(prop(a[j],'Case_Ignorable'))continue;return !prop(a[j],'Cased')}return true}
  if(cond==='After_Soft_Dotted'||cond==='After_I'){for(let j=i-1;j>=0;j--){if(cond==='After_I'&&a[j]===0x49)return true;if(cond==='After_Soft_Dotted'&&prop(a[j],'Soft_Dotted'))return true;const cc=D.ccc[a[j]]||0;if(cc===0||cc===230)return false}return false}
  if(cond==='More_Above'){for(let j=i+1;j<a.length;j++){const cc=D.ccc[a[j]]||0;if(cc===230)return true;if(cc===0)return false}return false}
  if(cond==='Before_Dot'){for(let j=i+1;j<a.length;j++){if(a[j]===0x307)return true;const cc=D.ccc[a[j]]||0;if(cc===0||cc===230)return false}return false}
  if(cond.startsWith('Not_'))return !condition(cond.slice(4),i);
  return cond===locale;
 }
 return textOf(a.flatMap((cp,i)=>{for(const [n,c,m] of D.special){if(cp===n&&c.split(/\s+/).every(x=>condition(x,i)))return m[mode]}return D.case[cp]?.[mode]||[cp]}));
}
function graphemes(s){
 const a=points(s),out=[];let current=[];
 const g=(i,p)=>i>=0&&prop(a[i],'GCB_'+p);
 for(let i=0;i<a.length;i++){
  let br=i>0;
  if(i===0)br=false;
  else if(g(i-1,'CR')&&g(i,'LF'))br=false;
  else if(['Control','CR','LF'].some(p=>g(i-1,p)||g(i,p)))br=true;
  else if(g(i-1,'L')&&['L','V','LV','LVT'].some(p=>g(i,p)))br=false;
  else if((g(i-1,'LV')||g(i-1,'V'))&&(g(i,'V')||g(i,'T')))br=false;
  else if((g(i-1,'LVT')||g(i-1,'T'))&&g(i,'T'))br=false;
  else if(g(i,'Extend')||g(i,'ZWJ')||g(i,'SpacingMark')||g(i-1,'Prepend'))br=false;
  else {
   if(prop(a[i],'InCB_Consonant')){let j=i-1,link=false;while(j>=0&&(prop(a[j],'InCB_Extend')||prop(a[j],'InCB_Linker'))){link ||= prop(a[j],'InCB_Linker');j--}if(link)br=false}
   if(prop(a[i],'Extended_Pictographic')&&g(i-1,'ZWJ')){let j=i-2;while(g(j,'Extend'))j--;if(j>=0&&prop(a[j],'Extended_Pictographic'))br=false}
   if(g(i-1,'Regional_Indicator')&&g(i,'Regional_Indicator')){let j=i-1;while(g(j,'Regional_Indicator'))j--;if((i-1-j)%2===1)br=false}
  }
  if(br){out.push(textOf(current));current=[]}current.push(a[i]);
 }
 if(current.length)out.push(textOf(current));return out;
}
function characterName(cp){let l=0,h=D.names.length-1;while(l<=h){let m=(l+h)>>>1,[a,b,n]=D.names[m];if(cp<a)h=m-1;else if(cp>b)l=m+1;else return a===b?n:n+' · '+label(String.fromCodePoint(cp))}return 'UNASSIGNED (nincs kiosztva)'}
window.UnicodeViewer={D,points,label,normalize,caseMap,graphemes,inventories,characterName};
