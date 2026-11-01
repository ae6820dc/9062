'use strict';
importScripts('../advanced-algebra/math.js','core.js');
const calculate=createCalculator(math);
onmessage=e=>{try{postMessage({result:calculate(e.data.expression,e.data.ans)});}catch(err){postMessage({error:err.message});}};
