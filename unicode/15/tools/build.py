"""Deterministic UCD compiler. Run from any directory; no runtime network."""
from pathlib import Path
import json,re,subprocess,hashlib,html
from exemplars import load as load_exemplars
R=Path(__file__).resolve().parents[1]; U=R/'data/ucd'
def lines(name):
 for line in (U/name).read_text().splitlines():
  s=line.split('#')[0].strip()
  if s:yield [v.strip() for v in s.split(';')]
def span(s):
 v=s.split('..');return range(int(v[0],16),int(v[-1],16)+1)
def ranges(values):
 out=[]
 for x in sorted(set(values)):
  if out and out[-1][1]+1==x:out[-1][1]=x
  else:out.append([x,x])
 return out
rows={};names=[];start=None
for f in lines('UnicodeData.txt'):
 cp=int(f[0],16)
 if f[1].endswith(', First>'):start=(cp,f);continue
 if f[1].endswith(', Last>'):
  a,g=start
  for n in range(a,cp+1):rows[n]=g
  names.append([a,cp,g[1][1:-8]])
 else:rows[cp]=f;names.append([cp,cp,f[1]])
assigned={cp for cp,f in rows.items() if f[2] not in ('Cs','Co')}
ccc={str(cp):int(f[3]) for cp,f in rows.items() if f[3]!='0'}
decomp={str(cp):[int(x,16) for x in f[5].split() if not x.startswith('<')] for cp,f in rows.items() if f[5]}
compat=[cp for cp,f in rows.items() if f[5].startswith('<')]
excluded=set()
for f in lines('DerivedNormalizationProps.txt'):
 if f[1]=='Full_Composition_Exclusion':excluded.update(span(f[0]))
compose={','.join(map(str,v)):int(k) for k,v in decomp.items() if int(k) not in excluded and int(k) not in compat and len(v)==2}
case={}
for cp,f in rows.items():
 if any(f[x] for x in (12,13,14)):case[str(cp)]={k:[int(f[i],16)] for k,i in [('upper',12),('lower',13),('title',14)] if f[i]}
special=[]
for f in lines('SpecialCasing.txt'):
 cp=int(f[0],16);m={k:[int(x,16) for x in f[i].split()] for k,i in [('lower',1),('title',2),('upper',3)]}
 if len(f)>4 and f[4]:special.append([cp,f[4],m])
 else:case.setdefault(str(cp),{}).update(m)
props={}
for name in ['DerivedCoreProperties.txt','PropList.txt','auxiliary/GraphemeBreakProperty.txt','emoji/emoji-data.txt']:
 for f in lines(name):
  key='InCB_'+f[2] if f[1]=='InCB' and len(f)>2 else f[1]
  if name.endswith('GraphemeBreakProperty.txt'):key='GCB_'+key
  if key in ['Cased','Case_Ignorable','Soft_Dotted','Extended_Pictographic','InCB_Consonant','InCB_Extend','InCB_Linker','Math'] or key.startswith('GCB_'):
   props.setdefault(key,[]).extend(span(f[0]))
props={k:ranges(v) for k,v in props.items()}
alias={f[1]:f[2] for f in lines('PropertyValueAliases.txt') if f[0]=='sc'}
script={}
for f in lines('Scripts.txt'):
 for cp in span(f[0]):script[cp]=f[1]
for f in lines('ScriptExtensions.txt'):
 for cp in span(f[0]):script[cp]=[alias.get(x,x) for x in f[1].split()]
collections=[]
def add(id,label,kind,points,coverage,source):
 rr=ranges(points);collections.append(dict(id=id,label=label,kind=kind,ranges=rr,count=sum(b-a+1 for a,b in rr),coverage=coverage,source=source))
legacy=(R.parent/'14/sample1.html').read_text();fragment=legacy.split("const latin=")[1].split('function mathCharacters')[0]
old=json.loads(subprocess.check_output(['node','-e',"const latin="+fragment+"; console.log(JSON.stringify({sets,ranges,mathRanges,numberRanges,mathExtras}));"]).decode())
labels=dict(re.findall(r'<option value="(.*?)">(.*?)</option>',legacy))
def closure(points):
 points=list(points);out=set(points);todo=list(points)
 while todo:
  cp=todo.pop()
  extra=decomp.get(str(cp),[])+sum(case.get(str(cp),{}).values(),[])
  for n in extra:
   if n in assigned and n not in out:out.add(n);todo.append(n)
 return out
languageEvidence={}
for id,s in old['sets'].items():
 cldr,sequences,evidence=load_exemplars(R/'data/cldr',id)
 assert cldr<=assigned,('CLDR contains unassigned scalars',id,cldr-assigned)
 languageEvidence[id]={'cldrVersion':'48','sequences':sequences,'exemplars':evidence}
 add(id,labels[id]+' · CLDR nyelvi válogatás','language',closure(set(map(ord,s))|cldr|({0x130} if id=='tr' else set())),'CLDR 48 main/auxiliary/index skalárvetület + v14 kompatibilitás + UCD betűalak/felbontás; nem teljes nyelvi leltár.','CLDR 48 '+id+'.xml + UnicodeData + SpecialCasing + v14')
for id,ss in [('bo',['Tibetan']),('ko',['Hangul']),('ja',['Han','Hiragana','Katakana']),('zh',['Han'])]:
 pts=[cp for cp,v in script.items() if cp in assigned and any(s in (v if isinstance(v,list) else [v]) for s in ss)]
 add(id,labels[id]+' · írásrendszer-gyűjtemény','script',pts,'Teljes hozzárendelt Script_Extensions unió; nem teljes nyelvi leltár.','Scripts + ScriptExtensions')
math=set(map(ord,old['mathExtras']))
for a,b in old['mathRanges']+old['numberRanges']:math.update(range(a,b+1))
math.update(cp for cp,f in rows.items() if f[2].startswith('N'))
for a,b in props['Math']:math.update(range(a,b+1))
add('math','Matematika · tulajdonság + örökölt válogatás','property',math&assigned,'Teljes Math tulajdonság és összes számkategória, továbbá v14 válogatás.','DerivedCoreProperties + UnicodeData + v14')
add('unicode','Unicode · összes kiosztott skalár (Co nélkül)','assigned',assigned,'Teljes UCD-kiosztás a privát használat és helyettesítők kivételével; vezérlők és formázók szerepelnek.','UnicodeData')
for s in sorted(set(alias.values())|{v for v in script.values() if isinstance(v,str)}):
 pts=[cp for cp,v in script.items() if cp in assigned and s in (v if isinstance(v,list) else [v])]
 if pts:add('script:'+s,s+' · teljes Script_Extensions','script',pts,'Teljes kiosztott Script_Extensions; nem nyelv.','Scripts + ScriptExtensions')
for f in lines('Blocks.txt'):
 pts=[cp for cp in span(f[0]) if not 0xD800<=cp<=0xDFFF]
 if pts:add('block:'+f[1],f[1]+' · teljes skalárblokk','block',pts,'Teljes skalárblokk: nem kiosztott és privát kódpontok is lehetnek; nem nyelv.','Blocks')
for cat in sorted({f[2] for f in rows.values()}-{'Cs','Co'}):add('category:'+cat,cat+' · teljes kategória','category',[cp for cp in assigned if rows[cp][2]==cat],'Teljes UCD általános kategória.','UnicodeData')
data=dict(version='18.0.0',languageEvidence=languageEvidence,collections=collections,names=names,ccc=ccc,decomp=decomp,compat=compat,compose=compose,case=case,special=special,props=props)
(R/'data/compiled.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')))
# Keep the baseline layout and controls; replace only inventory/runtime and add explicit transforms.
base=legacy.split('<script>')[0]
base=re.sub(r'<link rel="icon".*?</head>', '</head>',base,flags=re.S)
base=re.sub(r'<select id="set">.*?</select>','<select id="set"></select>',base)
base=base.replace('Program ID: 84ABE3DBF8C23C7C059E633757F96E7C','Unicode Viewer v15 · Nanobot Swarm · Program ID: PROGRAM_ID')
base=base.replace('</style>', '''\n.codepoint{white-space:normal;text-align:center;max-height:100px;overflow:auto;font-size:clamp(32px,6vw,48px);width:max-content;max-width:calc(100vw - 80px)}.codepoint.sequence{font-size:clamp(20px,5vw,48px)}#status{display:block!important}main{overflow-anchor:none}#details{box-sizing:border-box;width:100%;max-width:100%;height:160px;min-height:160px;max-height:160px;margin:16px 0;padding:16px;border:1px solid #30415d;border-radius:18px;background:radial-gradient(circle at center,#172745,#070d19);color:#cbd8ed;line-height:1.6;overflow-y:auto;overflow-x:hidden;overflow-wrap:anywhere;scrollbar-gutter:stable;overscroll-behavior-y:contain}#jumpTitle{margin:0}.screen:fullscreen{width:100%;height:100%;border-radius:0}.glyph{unicode-bidi:isolate} .transforms{display:flex;flex-wrap:wrap;gap:10px;margin:12px 0}.transforms label{flex-basis:130px}\n</style>''')
base=base.replace('<p id="poolCount"','<div class="transforms"><label>Normalizálás<select id="normal"><option>Original</option><option>NFC</option><option>NFD</option><option>NFKC</option><option>NFKD</option></select></label><label>Betűalak<select id="case"><option value="original">Eredeti</option><option value="upper">Nagybetű</option><option value="lower">Kisbetű</option><option value="title">Címbetű (kódpontonként)</option></select></label><label>Nyelvi szabály<select id="locale"><option value="und">Alap</option><option value="tr">Török</option><option value="az">Azeri</option><option value="lt">Litván</option></select></label></div><p id="poolCount"')
base=base.replace('<span id="status">','<span role="status" id="status">').replace('</main>','<section id="details" role="region" aria-label="Karakterinformációk" tabindex="0"></section><p><a href="readme.html">Magyar útmutató és teljes készletjegyzék</a></p></main>')
base=base.replace('<div class="jump-options">','<h2 id="jumpTitle">Keresés és ugrás</h2><div class="jump-options">').replace('</div><label id="jumpLabel">','<label><input type="radio" name="jumpMode" value="sequence"> Sorozat</label></div><label><input id="globalSearch" type="checkbox"> Keresés az összes kiosztott skalár között</label><label id="jumpLabel">')
for n in range(1,4):
 pid=hashlib.sha256(f'9062/unicode/15/program/{n}'.encode()).hexdigest()[:16].upper();key=hashlib.sha256(f'9062/unicode/15/storage/{n}'.encode()).hexdigest()[:16].upper()
 icon=f'<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2212%22 fill=%22%23{["345bdb","14876d","9b42b7"][n-1]}%22/%3E%3Ctext x=%2232%22 y=%2247%22 text-anchor=%22middle%22 font-size=%2244%22 fill=%22white%22%3E{n}%3C/text%3E%3C/svg%3E">'
 page=base.replace('PROGRAM_ID',pid).replace('</head>',icon+'</head>')
 page+='<!-- Unicode 18.0.0; final-18.0-20260916; e1521a0131d620999682a1f101252ad4b6024c7c\n'+(R/'data/LICENSE.txt').read_text()+'\n-->'
 page+='<script id="ucd" type="application/json">'+json.dumps(data,ensure_ascii=True,separators=(',',':'))+'</script>\n<script>const STORAGE_KEY='+json.dumps(key)+';\n'+(R/'tools/core.js').read_text()+'\n'+(R/'tools/ui.js').read_text()+'</script></body></html>\n'
 (R/f'sample{n}.html').write_text(page)
print(f'Built {len(collections)} collections; {len(assigned)} assigned non-private scalars')
