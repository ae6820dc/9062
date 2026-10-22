'use strict';
importScripts('math.js','engine.js');
onmessage = e => {try {const {domain,operation,inputs}=e.data; const r=Lab[domain](operation,inputs); function check(v){if(typeof v==='number'&&!Number.isFinite(v))throw Error('Numerical overflow or undefined result. Rescale inputs or use another method.');if(v&&typeof v==='object')for(const x of Object.values(v))check(x);}check(r.values);postMessage({result:JSON.parse(JSON.stringify(r,(_,v)=>typeof v==='bigint'?v.toString():v))});} catch(err) {postMessage({error:err.message||'Calculation failed.'});}};
