"""Discover every sample, preserve original bytes, and record source identity."""
from pathlib import Path
import hashlib,json,re,shutil
project=Path(__file__).resolve().parent
repo=project.parent
output=project/'app/build/generated/offline'
if output.exists():shutil.rmtree(output)
output.mkdir(parents=True)
catalog=[];checksums={};inventory={}
for version in range(1,16):
 folder=repo/'unicode'/str(version)
 samples=sorted(folder.glob('sample*.html'),key=lambda p:int(re.fullmatch(r'sample(\d+)\.html',p.name)[1]))
 expected=12 if version>=12 else 3
 assert [p.name for p in samples]==[f"sample{s}.html" for s in range(1,expected+1)],(version,[p.name for p in samples],expected)
 inventory[str(version)]=[p.name for p in samples]
 for source in samples:
  html=source.read_text()
  identity=re.search(r'Program ID:(?:</strong>)?\s*(?:<code[^>]*>)?([A-Fa-f0-9]{16,64})',html)
  assert identity,source
  keys=re.findall(r'\b(?:const|let|var)\s+STORAGE_KEY\s*=\s*[\'\"]([^\'\"]+)',html)
  sample=int(re.fullmatch(r'sample(\d+)\.html',source.name)[1])
  catalog.append(dict(id=f'unicode-{version}-{sample}',group=f'Unicode {version}',name=f'Sample {sample}',path=str(source.relative_to(repo)),kind='unicode',programId=identity[1],storageKey=keys[0] if keys else None,storageKeys=keys))
 # Include all supporting files, regardless of extension. Development tests/tools
 # and prior APKs are not runtime assets. Original source trees stay untouched.
 for source in folder.rglob('*'):
  if not source.is_file() or any(x in source.relative_to(folder).parts for x in ('tests','tools','node_modules','.git')) or source.suffix=='.apk' or source.name in ('package.json','package-lock.json','.gitignore'):continue
  rel=source.relative_to(repo);target=output/'site'/rel
  target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,target)
  checksums[str(rel)]=hashlib.sha256(source.read_bytes()).hexdigest()
  assert source.read_bytes()==target.read_bytes()
assert len(catalog)==81
assert len({p['id'] for p in catalog})==81
assert len({p['programId'] for p in catalog})==81
for name,data in [('catalog.json',catalog),('source-checksums.json',checksums),('inventory.json',inventory)]:
 (output/name).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
shutil.copyfile(project/'host.js',output/'host.js')
print(json.dumps(dict(programs=len(catalog),samples={v:len(s) for v,s in inventory.items()},originalFiles=len(checksums))))
