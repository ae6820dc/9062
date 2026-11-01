'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const math=require(process.env.MATH_RUNTIME||'../advanced-algebra/math.js');
const calculate=require('./core.js').createCalculator(math);
let passed=0;
for(const [input,expected,ans] of [
 ['25+37','62'],['(25+37)*2','124'],['2^10','1024'],['2^3^2','512'],['-2^2','-4'],['(-2)^2','4'],['2^-3','0.125'],
 ['0,1+0,2','0.3'],['9007199254740993+1','9007199254740994'],['99999999999999999999+1','100000000000000000000'],
 ['10%^2','0.01'],['(10+5)%','0.15'],['1e-3%','0.00001'],['15%','0.15'],['200+15%','200.15'],['200*15/100','30'],['200*(1+15/100)','230'],['200*(1-15/100)','170'],
 ['Ans*2','124','62'],['2×3+8÷4','8'],['(−5)+3','-2'],['1e3+2','1002'],['0^0','1'],['1/8','0.125'],['3^100','5.15377520732011331036461129765621272702107522001e+47']
]){assert.equal(calculate(input,ans),expected,input);passed++;}
for(const input of ['', '1/0', '0^-1','sqrt(2)','a=2','[1,2]','random()','import("x")','2(3)','2^10001','9^0.5','1e999999','true','"3"','2+','1;2']){assert.throws(()=>calculate(input),input);passed++;}
assert.equal(calculate('1/3').split('.')[1].length,80);passed++;
assert.equal(calculate('2^10000').startsWith('1.995063116'),true);passed++;
console.log(`${passed} arithmetic and validation checks passed`);
