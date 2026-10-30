"""Discover every sample, preserve original bytes, and record source identity."""
from pathlib import Path
import hashlib,json,re,shutil
project=Path(__file__).resolve().parent
repo=project.parent
output=project/'app/build/generated/offline'
if output.exists():shutil.rmtree(output)
output.mkdir(parents=True)
catalog=[];checksums={};inventory={}
for version in range(16,20):
 folder=repo/'unicode'/str(version)
 samples=sorted(folder.glob('sample*.html'),key=lambda p:int(re.fullmatch(r'sample(\d+)\.html',p.name)[1]))
 assert samples, (version,"No samples found")
 inventory[str(version)]=[p.name for p in samples]
 for source in samples:
  html=source.read_text()
  identity=re.search(r'Program ID:(?:</strong>)?\s*(?:<code[^>]*>)?([A-Fa-f0-9]{16,64})',html)
  assert identity,source
  keys=re.findall(r'\b(?:const|let|var)\s+STORAGE_KEY\s*=\s*[\'\"]([^\'\"]+)',html)
  sample=int(re.fullmatch(r'sample(\d+)\.html',source.name)[1])
  catalog.append(dict(id=f'unicode-{version}-{sample}',group=f'Unicode {version}',name=f'Sample {sample}',path=str(source.relative_to(repo)),kind='unicode',programId=identity[1],storageKey=keys[0] if keys else None,storageKeys=keys))
 # These standalone samples embed their CSS, JS and images. Copy only samples.
 for source in samples:
  rel=source.relative_to(repo);target=output/'site'/rel
  target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,target)
  checksums[str(rel)]=hashlib.sha256(source.read_bytes()).hexdigest()
assert len(catalog)==len(catalog)
assert len({p['id'] for p in catalog})==len(catalog)
assert len({p['programId'] for p in catalog})==len(catalog)
for name,data in [('catalog.json',catalog),('source-checksums.json',checksums),('inventory.json',inventory)]:
 (output/name).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
shutil.copyfile(project/'host.js',output/'host.js')
print(json.dumps(dict(programs=len(catalog),samples={v:len(s) for v,s in inventory.items()},originalFiles=len(checksums))))
