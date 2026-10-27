"""Independent exhaustive comparison with bundled normative UCD source files."""
import json,re,hashlib,subprocess
from cldr_reference import reference as cldr_reference
from pathlib import Path
R=Path(__file__).resolve().parents[1];U=R/'data/ucd';D=json.loads((R/'data/compiled.json').read_text());M=json.loads((R/'data/manifest.json').read_text())
def records(name):
 for s in (U/name).read_text().splitlines():
  s=s.split('#')[0].strip()
  if s:yield [x.strip() for x in s.split(';')]
def expand(s):
 a=s.split('..');return set(range(int(a[0],16),int(a[-1],16)+1))
def unpack(c):return {n for a,b in c['ranges'] for n in range(a,b+1)}
rows={};first=None
for f in records('UnicodeData.txt'):
 cp=int(f[0],16)
 if f[1].endswith(', First>'):first=cp
 elif f[1].endswith(', Last>'):
  for n in range(first,cp+1):rows[n]=f
 else:rows[cp]=f
assigned={n for n,f in rows.items() if f[2] not in ('Cs','Co')}
sc={}
for r,s in records('Scripts.txt'):
 for cp in expand(r):sc[cp]={s}
alias={f[1]:f[2] for f in records('PropertyValueAliases.txt') if f[0]=='sc'}
for r,s in records('ScriptExtensions.txt'):
 for cp in expand(r):sc[cp]={alias[x] for x in s.split()}
blocks={name:expand(r)-set(range(0xD800,0xE000)) for r,name in records('Blocks.txt')}
for name,info in M['files'].items():assert hashlib.sha256((U/name).read_bytes()).hexdigest()==info['sha256'],name
CM=json.loads((R/'data/cldr-manifest.json').read_text())
for name,info in CM['files'].items():assert hashlib.sha256((R/'data/cldr'/name).read_bytes()).hexdigest()==info['sha256'],name
cldr_points={}
for locale,evidence in D['languageEvidence'].items():
 pts,strings,exemplars=cldr_reference(R/'data/cldr',locale)
 assert strings==evidence['sequences'],locale
 assert exemplars==evidence['exemplars'],locale
 cldr_points[locale]=pts
# Independently compare every compiled case/decomposition/combining record to the normative files.
expected_case={};expected_special=[]
for n,f in rows.items():
 m={k:[int(f[i],16)] for k,i in [('upper',12),('lower',13),('title',14)] if f[i]}
 if m:expected_case[str(n)]=m
for f in records('SpecialCasing.txt'):
 m={k:[int(x,16) for x in f[i].split()] for k,i in [('lower',1),('title',2),('upper',3)]}
 if f[4]:expected_special.append([int(f[0],16),f[4],m])
 else:expected_case.setdefault(str(int(f[0],16)),{}).update(m)
assert D['case']==expected_case
assert D['special']==expected_special
assert D['ccc']=={str(n):int(f[3]) for n,f in rows.items() if f[3]!='0'}
assert D['decomp']=={str(n):[int(x,16) for x in f[5].split() if not x.startswith('<')] for n,f in rows.items() if f[5]}

# Independent closure using raw simple and full unconditional casing / canonical+compat decompositions.
adj={}
for n,f in rows.items():
 adj[n]={int(v,16) for i in (12,13,14) if (v:=f[i])}
 adj[n].update(int(x,16) for x in f[5].split() if not x.startswith('<'))
for f in records('SpecialCasing.txt'):
 if not f[4]:adj[int(f[0],16)].update(int(x,16) for x in ' '.join(f[1:4]).split())
legacy=(R.parent/'14/sample1.html').read_text();frag=legacy.split('const latin=')[1].split('function mathCharacters')[0]
old=json.loads(subprocess.check_output(['node','-e','const latin='+frag+';console.log(JSON.stringify({sets,mathRanges,numberRanges,mathExtras}))']))
for c in D['collections']:
 actual=unpack(c);assert len(actual)==c['count'];assert all(0<=n<=0x10FFFF and not 0xD800<=n<=0xDFFF for n in actual)
 kind=c['kind'];id=c['id']
 if kind=='assigned':expected=assigned
 elif kind=='script':
  scripts={'bo':{'Tibetan'},'ko':{'Hangul'},'ja':{'Han','Hiragana','Katakana'},'zh':{'Han'}}.get(id,{id.removeprefix('script:')})
  expected={n for n in assigned if sc.get(n,set())&scripts}
 elif kind=='block':expected=blocks[id[6:]]
 elif kind=='category':expected={n for n in assigned if rows[n][2]==id[9:]}
 elif kind=='language':
  expected=set(map(ord,old['sets'][id]))|cldr_points[id];expected.update({0x130} if id=='tr' else set());changed=True
  while changed:
   before=len(expected);new=set()
   for n in expected:new|=adj.get(n,set())
   expected|=new&assigned;changed=len(expected)!=before
 elif kind=='property':
  expected=set(map(ord,old['mathExtras']))
  for a,b in old['mathRanges']+old['numberRanges']:expected.update(range(a,b+1))
  expected.update(n for n,f in rows.items() if f[2].startswith('N'))
  for f in records('DerivedCoreProperties.txt'):
   if f[1]=='Math':expected|=expand(f[0])
  expected &= assigned
 assert actual==expected,(id,len(actual^expected))
 if kind!='block':assert actual<=assigned
# Four complete programs' identities are checked separately from their generated inventories.
ids=[];keys=[];icons=[]
for n in range(1,4):
 s=(R/f'sample{n}.html').read_text();pid=re.search(r'Program ID: ([A-F0-9]{16})',s)[1];key=re.search(r'const STORAGE_KEY="([A-F0-9]{16})"',s)[1]
 assert json.loads(re.search(r'<script id="ucd" type="application/json">(.*?)</script>',s,re.S)[1])==D
 ids.append(pid);keys.append(key);icons.append(re.search(r'<link rel="icon".*?>',s)[0])
assert len(set(ids+keys))==6;assert len(set(icons))==3
repo=R.parents[1];prior=subprocess.check_output(['git','ls-files','unicode'],cwd=repo).decode().splitlines()
for f in prior:
 if f.startswith('unicode/15/'):continue
 original=subprocess.check_output(['git','show','HEAD:'+f],cwd=repo)
 assert (repo/f).read_bytes()==original,f
 for key in ids+keys:assert key.encode() not in original
result={'collectionsCompared':len(D['collections']),'assignedScalars':len(assigned),'sourceHashesVerified':len(M['files'])+len(CM['files']),'cldrExemplarsVerifiedWithICU':sum(len(v['exemplars']) for v in D['languageEvidence'].values()),'previousFilesUnchanged':len([f for f in prior if not f.startswith('unicode/15/')]),'uniqueProgramIDs':ids,'uniqueStorageKeys':keys}
(R/'tests/inventory-results.json').write_text(json.dumps(result,indent=2)+'\n');print(result)
