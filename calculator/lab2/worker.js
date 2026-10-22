importScripts('../advanced-algebra/math.js','../advanced-algebra/engine.js','engine.js');
onmessage=e=>{try{const d=e.data;postMessage({result:Advanced.run(d.domain,d.operation,d.inputs,d.precision,d.budget,p=>postMessage({progress:p}))})}catch(e){postMessage({error:e.message})}};
