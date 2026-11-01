/* Mathematics Studio III – restricted scalar arithmetic. math.js Apache-2.0. */
(function(root){
'use strict';
function createCalculator(math){
 const m=math.create({number:'BigNumber',precision:80,predictable:true});
 const ops=new Set(['add','subtract','multiply','divide','pow','unaryMinus','unaryPlus']);
 return function calculate(source,ans='0'){
  if(typeof source!=='string'||source.length>512||!source.trim())throw Error('Írj be egy számítást (legfeljebb 512 karakter).');
  let normalized=source.replace(/,/g,'.').replace(/×/g,'*').replace(/[÷:]/g,'/').replace(/−/g,'-');
  // Resolve postfix percentages before parsing so + never changes their meaning.
  let expanded='';
  for(const ch of normalized){
   if(ch!=='%'){expanded+=ch;continue;}
   expanded=expanded.trimEnd();let start=-1;
   if(expanded.endsWith(')')){let depth=0;for(let i=expanded.length-1;i>=0;i--){if(expanded[i]===')')depth++;if(expanded[i]==='('&&--depth===0){start=i;break;}}}
   else {const atom=expanded.match(/(?:Ans|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)$/);if(atom)start=atom.index;}
   if(start<0)throw Error('A % jelet szám vagy zárójeles kifejezés után írd.');
   expanded=expanded.slice(0,start)+'('+expanded.slice(start)+'/100)';
  }
  normalized=expanded;
  let node;try{node=m.parse(normalized);}catch{throw Error('Hibás kifejezés. Ellenőrizd a számokat és a zárójeleket.');}
  let count=0;
  node.traverse(n=>{
   if(++count>180)throw Error('Túl hosszú a számítás.');
   if(n.isConstantNode){if(typeof n.value!=='number'&&!m.isBigNumber(n.value))throw Error('Csak számok használhatók.');if(!m.bignumber(n.value).isFinite()||Math.abs(m.bignumber(n.value).e)>100000)throw Error('Túl nagy szám.');}
   else if(n.isOperatorNode){if(!ops.has(n.fn)||n.implicit)throw Error('Használj +, −, ×, ÷ és ^ műveleteket.');}
   else if(n.isSymbolNode){if(n.name!=='Ans')throw Error('Az alapnézetben csak az Ans (előző eredmény) használható.');}
   else if(!n.isParenthesisNode)throw Error('Ezt a műveletet a Haladó funkciók között találod.');
  });
  function run(n){
   if(n.isParenthesisNode)return run(n.content);
   if(n.isConstantNode)return m.bignumber(n.value);
   if(n.isSymbolNode){const a=m.bignumber(ans);if(!a.isFinite())throw Error('Nincs használható előző eredmény.');return a;}
   const a=n.args.map(run);
   if(n.fn==='divide'&&a[1].isZero())throw Error('Nullával nem lehet osztani.');
   if(n.fn==='pow'&&(!a[1].isInteger()||a[1].abs().gt(10000)))throw Error('Az alapnézetben a kitevő egész szám lehet −10000 és 10000 között.');
   const out=m[n.fn](...a);
   if(!m.isBigNumber(out)||!out.isFinite()||Math.abs(out.e)>100000)throw Error('Az eredmény túl nagy, vagy nem véges valós szám.');
   return out;
  }
  try{return run(node).toString();}catch(e){if(e.message&&/[áéíóöőúüű]/i.test(e.message))throw e;throw Error('A számítás nem végezhető el. Ellenőrizd a műveletet.');}
 };
}
if(typeof module!=='undefined')module.exports={createCalculator};else root.createCalculator=createCalculator;
})(typeof self!=='undefined'?self:globalThis);
