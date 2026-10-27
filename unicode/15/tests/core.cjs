const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path');
const root=path.resolve(__dirname,'..'),D=JSON.parse(fs.readFileSync(root+'/data/compiled.json'));
const ctx={document:{getElementById:()=>({textContent:JSON.stringify(D)})},window:{}};vm.createContext(ctx);vm.runInContext(fs.readFileSync(root+'/tools/core.js','utf8'),ctx);const V=ctx.window.UnicodeViewer;
let normalization=0,grapheme=0,cases=0,entries=0;
const str=s=>s.trim().split(/\s+/).filter(Boolean).map(x=>String.fromCodePoint(parseInt(x,16))).join('');
for(let line of fs.readFileSync(root+'/data/ucd/NormalizationTest.txt','utf8').split('\n')){
 line=line.split('#')[0].trim();if(!line||line.startsWith('@'))continue;const c=line.split(';').slice(0,5).map(str);
 for(let i=0;i<5;i++){assert.equal(V.normalize(c[i],'NFC'),c[i<3?1:3]);assert.equal(V.normalize(c[i],'NFD'),c[i<3?2:4]);assert.equal(V.normalize(c[i],'NFKC'),c[3]);assert.equal(V.normalize(c[i],'NFKD'),c[4]);normalization+=4}
}
for(let line of fs.readFileSync(root+'/data/ucd/auxiliary/GraphemeBreakTest.txt','utf8').split('\n')){
 line=line.split('#')[0].trim();if(!line)continue;const clusters=line.split('÷').map(t=>str(t.replaceAll('×',' '))).filter(Boolean),s=clusters.join('');assert.deepEqual(Array.from(V.graphemes(s)),clusters,line);grapheme++;
}
for(const c of D.collections){const p=V.inventories.get(c.id);assert.equal(p.length,c.count);let previous=-1;for(let i=0;i<p.length;i++){const s=p.at(i),cp=s.codePointAt(0);assert(cp>previous);assert.equal(p.indexOf(cp),i);assert.equal(V.label(s),'U+'+cp.toString(16).toUpperCase().padStart(4,'0'));previous=cp;entries++}assert.equal(p.at(p.length),undefined)}
for(const [cp,m] of Object.entries(D.case))for(const [mode,a] of Object.entries(m)){// Context-free entry; Final_Sigma requires cased context, locale rules are explicit.
 assert.equal(V.caseMap(String.fromCodePoint(+cp),mode),String.fromCodePoint(...a));cases++;
}
for(const [s,mode,locale,want] of [['i','upper','tr','İ'],['I','lower','tr','ı'],['İ','lower','tr','i'],['I\u0307','lower','tr','i'],['ΟΣ','lower','und','ος'],['ΟΣΑ','lower','und','οσα'],['ß','upper','und','SS'],['ǆ','title','und','ǅ'],['I\u0301','lower','lt','i\u0307\u0301']])assert.equal(V.caseMap(s,mode,locale),want);
assert.equal(V.label('👩\u200D🚀'),'U+1F469 U+200D U+1F680');assert.equal(V.normalize('é','NFD'),'e\u0301');assert.equal(V.graphemes('👩\u200D🚀').length,1);assert.equal(V.graphemes('✈\uFE0F').length,1);
const result={unicode:D.version,normalizationAssertions:normalization,officialGraphemeCases:grapheme,caseMappings:cases,inventoryEntries:entries,collections:D.collections.length};fs.writeFileSync(root+'/tests/core-results.json',JSON.stringify(result,null,2)+'\n');console.log(result);
