/* Mathematics Studio III – restricted scalar arithmetic. math.js Apache-2.0. */
(function(root){
'use strict';
function createCalculator(math){
 const m=math.create({number:'BigNumber',precision:80,predictable:true});
 const ops=new Set(['add','subtract','multiply','divide','pow','unaryMinus','unaryPlus']);
 return function calculate(source,ans='0'){
  if(typeof source!=='string'||source.length>512||!source.trim())throw Error('Enter an expression (up to 512 characters).');
  let normalized=source.replace(/,/g,'.').replace(/×/g,'*').replace(/[÷:]/g,'/').replace(/−/g,'-');
  // Resolve postfix percentages before parsing so + never changes their meaning.
  let expanded='';
  for(const ch of normalized){
   if(ch!=='%'){expanded+=ch;continue;}
   expanded=expanded.trimEnd();let start=-1;
   if(expanded.endsWith(')')){let depth=0;for(let i=expanded.length-1;i>=0;i--){if(expanded[i]===')')depth++;if(expanded[i]==='('&&--depth===0){start=i;break;}}}
   else {const atom=expanded.match(/(?:Ans|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)$/);if(atom)start=atom.index;}
   if(start<0)throw Error('Place % after a number or a parenthesized expression.');
   expanded=expanded.slice(0,start)+'('+expanded.slice(start)+'/100)';
  }
  normalized=expanded;
  let node;try{node=m.parse(normalized);}catch{throw Error('Invalid expression. Check the numbers and parentheses.');}
  let count=0;
  node.traverse(n=>{
   if(++count>180)throw Error('The expression is too long.');
   if(n.isConstantNode){if(typeof n.value!=='number'&&!m.isBigNumber(n.value))throw Error('Only numbers are allowed.');if(!m.bignumber(n.value).isFinite()||Math.abs(m.bignumber(n.value).e)>100000)throw Error('The number is too large.');}
   else if(n.isOperatorNode){if(!ops.has(n.fn)||n.implicit)throw Error('Use the +, −, ×, ÷ and ^ operators.');}
   else if(n.isSymbolNode){if(n.name!=='Ans')throw Error('Only Ans (the previous result) is available in the basic calculator.');}
   else if(!n.isParenthesisNode)throw Error('This operation is available under Advanced functions.');
  });
  function run(n){
   if(n.isParenthesisNode)return run(n.content);
   if(n.isConstantNode)return m.bignumber(n.value);
   if(n.isSymbolNode){const a=m.bignumber(ans);if(!a.isFinite())throw Error('No valid previous result is available.');return a;}
   const a=n.args.map(run);
   if(n.fn==='divide'&&a[1].isZero())throw Error('Division by zero is not allowed.');
   if(n.fn==='pow'&&(!a[1].isInteger()||a[1].abs().gt(10000)))throw Error('In the basic calculator, the exponent must be an integer between −10000 and 10000.');
   const out=m[n.fn](...a);
   if(!m.isBigNumber(out)||!out.isFinite()||Math.abs(out.e)>100000)throw Error('The result is too large or is not a finite real number.');
   return out;
  }
  try{return run(node).toString();}catch(e){if(e instanceof Error&&e.message)throw e;throw Error('Unable to calculate. Check the expression.');}
 };
}
if(typeof module!=='undefined')module.exports={createCalculator};else root.createCalculator=createCalculator;
})(typeof self!=='undefined'?self:globalThis);
