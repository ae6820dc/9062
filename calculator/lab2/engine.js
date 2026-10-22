'use strict';
const Advanced = (()=>{
function run(domain,op,v,precision=50,budget=5000,progress=()=>{}){
 if(!Number.isInteger(precision)||precision<16||precision>1000)throw Error('Precision must be an integer from 16 to 1000.');
 if(!Number.isInteger(budget)||budget<10||budget>100000)throw Error('Work budget must be 10–100000.');
 const m=math.create({number:'BigNumber',precision:precision+20});let used=0;
 const tick=()=>{if(++used>budget)throw Error('Work budget exceeded. Increase limit or simplify input.');if(used%100===0)progress(used/budget)};
 const B=s=>{if(!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(String(s).trim())||String(s).length>5000)throw Error('Expected a finite decimal number.');const x=m.bignumber(s);if(!x.isFinite()||Math.abs(x.e)>10000)throw Error('Number exceeds supported exponent range.');return x};
 const text=x=>Array.isArray(x)?x.map(text):typeof x==='string'?x:m.format(x,{precision});
 const result=(title,values,steps,kind='Arbitrary precision')=>({title,values:Object.fromEntries(Object.entries(values).map(([k,x])=>[k,typeof x==='string'?x:JSON.stringify(text(x)).replace(/^"|"$/g,'')])),notes:[kind+' · '+(kind==='Exact rational'?'BigInt fractions':precision+' significant digits; 20 guard digits')+'.',...steps,'Rounding and conditioning can reduce accuracy. Residuals and refinement differences are diagnostics, not certified error bounds.'],plot:null});
 const safe=(s,vars=['x'])=>{Lab.expr(s,vars);return m.parse(s).compile()};
 const ev=(c,scope)=>{tick();const r=c.evaluate(scope);if(!m.isBigNumber(r)||!r.isFinite())throw Error('A finite real result is required.');return r};
 const list=s=>{const a=String(s).trim().split(/[\s,;]+/);if(!s.trim()||a.length>10000)throw Error('Use 1–10000 values.');return a.map(B)};
 if(op==='hpExpression'||op==='exactExpression'){
  const exact=op==='exactExpression';let mm=m;
  if(exact)mm=math.create({number:'Fraction'});
  if(!exact)Lab.expr(v.expression);const node=mm.parse(v.expression);let count=0;node.traverse(n=>{if(!exact)return;if(++count>160||!['ConstantNode','OperatorNode','ParenthesisNode'].includes(n.type)||n.isOperatorNode&&!['+','-','*','/','^'].includes(n.op))throw Error('Use numeric constants, parentheses and + - * / ^ only.');if(n.isConstantNode&&String(n.value).length>1000)throw Error('Constant too long.');});
  if(exact)node.traverse(n=>{if(n.isOperatorNode&&n.op==='^'){const exponent=n.args[1].compile().evaluate();if(exponent.d!==1n||exponent.n>10000n)throw Error('Exact powers require an integer exponent with magnitude at most 10000.');}});const x=node.compile().evaluate();if(!exact&&(!m.isBigNumber(x)||!x.isFinite()))throw Error('Use real arithmetic; choose legacy complex mode for complex values.');
  return result(exact?'Exact rational expression':'High-precision expression',{'Result':exact?x.toFraction():text(x)},['Parse the restricted arithmetic expression.','Evaluate every operation using '+(exact?'rational fractions; fractional powers may be unsupported.':'decimal arithmetic, including noninteger powers.')],exact?'Exact rational':'Arbitrary precision');
 }
 if(op==='hpComplex'){
  const ar=B(v.ar),ai=B(v.ai),br=B(v.br),bi=B(v.bi);let re,im;const action=v.action;
  if(action==='add'){re=ar.plus(br);im=ai.plus(bi)}else if(action==='subtract'){re=ar.minus(br);im=ai.minus(bi)}else if(action==='multiply'){re=ar.times(br).minus(ai.times(bi));im=ar.times(bi).plus(ai.times(br))}else if(action==='divide'){const d=br.times(br).plus(bi.times(bi));if(d.isZero())throw Error('Cannot divide by zero.');re=ar.times(br).plus(ai.times(bi)).div(d);im=ai.times(br).minus(ar.times(bi)).div(d)}else throw Error('High-precision complex mode supports add, subtract, multiply and divide. Use the original mode for principal complex powers.');
  const modulus=re.times(re).plus(im.times(im)).sqrt();return result('High-precision complex arithmetic',{'Real part':re,'Imaginary part':im,'Modulus':modulus},['Apply rectangular complex arithmetic using BigNumber components.','Compute modulus as sqrt(re² + im²).']);
 }
 if(op==='hpFunction'||op==='hpDerivative'){
  const c=safe(v.expression),x=B(v.x),value=ev(c,{x});const d=m.derivative(v.expression,'x');const dv=ev(d.compile(),{x});
  return result('Function & symbolic derivative',{'Value':value,'Derivative':d.toString(),'Derivative at x':dv},['Build a symbolic derivative using differentiation rules.','Evaluate the original expression and derivative independently in BigNumber arithmetic.']);
 }
 if(op==='hpRoot'){
  const c=safe(v.expression),f=x=>ev(c,{x});let a=B(v.a),b=B(v.b);if(!a.lt(b))throw Error('Lower bound must be smaller than upper bound.');let fa=f(a),fb=f(b);if(fa.isZero())b=a;else if(fb.isZero())a=b;else if(fa.isNegative()===fb.isNegative())throw Error('A sign-changing bracket is required.');
  const tol=B('1e-'+precision);let n=0;while(b.minus(a).abs().gt(tol.times(m.max(1,a.abs(),b.abs())))){tick();const x=a.plus(b).div(2),fx=f(x);n++;if(fx.isZero()){a=b=x;break}if(fx.isNegative()===fa.isNegative()){a=x;fa=fx}else b=x;}
  const x=a.plus(b).div(2);return result('High-precision bisection',{'Root':x,'Absolute residual':f(x).abs(),'Bracket width':b.minus(a),'Iterations':String(n)},['Validate opposite endpoint signs.','Bisect and retain the sign-changing half until the relative bracket target is reached.','Continuity is required; poles may create false sign changes.']);
 }
 if(op==='hpIntegral'){
  const c=safe(v.expression),a=B(v.a),b=B(v.b),f=x=>ev(c,{x});
  const sim=n=>{const h=b.minus(a).div(n);let s=f(a).plus(f(b));for(let i=1;i<n;i++)s=s.plus(f(a.plus(h.times(i))).times(i%2?4:2));return s.times(h).div(3)};
  let n=2,old=sim(n),value,err;const target=B(v.tolerance);if(!target.gt(0)||target.gt('.01'))throw Error('Tolerance must be positive and at most 0.01.');do{n*=2;value=sim(n);err=value.minus(old).abs().div(15);old=value;}while(err.gt(target));
  return result('High-precision composite Simpson refinement',{'Integral':value,'Refinement error estimate':err,'Panels':String(n),'Evaluations':String(used)},['Evaluate equally spaced composite Simpson sums.','Double panels until successive sums differ by at most 15 × tolerance.','Requires a smooth integrand; aliasing or singularities can invalidate the estimate.']);
 }
 if(op==='hpStats'){
  const a=list(v.data),n=a.length;let mean=B(0),s=B(0);for(let i=0;i<n;i++){tick();const delta=a[i].minus(mean);mean=mean.plus(delta.div(i+1));s=s.plus(delta.times(a[i].minus(mean)));}
  return result('Stable high-precision moments',{'Count':String(n),'Mean':mean,'Population variance':s.div(n),'Population standard deviation':s.div(n).sqrt(),'Sample variance':n>1?s.div(n-1):'Undefined: needs two values'},['Use Welford’s centered online recurrence.','Accumulate squared deviations without subtracting two large raw moments.']);
 }
 if(op==='exactMatrix'||op==='hpMatrix'){
  const exact=op==='exactMatrix';const mm=exact?math.create({number:'Fraction'}):m;
  const parse=s=>{if(!/^[\d\s,;.eE+\-/]+$/.test(s)||s.length>20000)throw Error('Use numeric matrix entries.');return s.trim().split(/[;\n]+/).map(r=>r.trim().split(/[\s,]+/).map(x=>exact?mm.fraction(x):B(x)))};
  const A=parse(v.A);if(!A.length||A.length>12||!A[0].length||A[0].length>12||A.some(r=>r.length!==A[0].length))throw Error('Use a rectangular matrix up to 12 × 12.');
  const R=A.map(r=>r.slice());let row=0;const steps=[];for(let col=0;col<R[0].length&&row<R.length;col++){
   let p=row;for(let j=row+1;j<R.length;j++)if(mm.larger(mm.abs(R[j][col]),mm.abs(R[p][col])))p=j;
   if(mm.equal(R[p][col],0))continue;[R[p],R[row]]=[R[row],R[p]];const d=R[row][col];R[row]=R[row].map(x=>mm.divide(x,d));for(let j=0;j<R.length;j++)if(j!==row){const t=R[j][col];R[j]=R[j].map((x,k)=>{tick();return mm.subtract(x,mm.multiply(t,R[row][k]))})}steps.push('Pivot '+(row+1)+' in column '+(col+1)+'; swap, normalize, eliminate.');row++;
  }
  return result('Row reduction',{'RREF':exact?R.map(r=>r.map(x=>x.toFraction())):R,'Rank':String(row),'Nullity':String(A[0].length-row)},[...steps,exact?'All pivots and zero tests are exact.':'Zero tests use computed values, without a tolerance. Prefer exact mode for rank; numerical near-singularity can misclassify rank.'],exact?'Exact rational':'Arbitrary precision');
 }
 const r=Lab[domain](op,v);r.notes.unshift((domain==='number'||op==='combinatorics'?'Exact integer algorithms where indicated.':'IEEE 754 double precision · approximately 15–16 significant digits. Configured BigNumber precision does not apply to this mode.'));return r;
}
return {run};
})();
if(typeof module!=='undefined')module.exports=Advanced;
