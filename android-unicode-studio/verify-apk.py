from pathlib import Path
import hashlib,json,sys,zipfile
p=Path(__file__).resolve().parent;r=p.parent
apk=Path(sys.argv[1])
with zipfile.ZipFile(apk) as z:
 catalog=json.loads(z.read('assets/catalog.json'));checksums=json.loads(z.read('assets/source-checksums.json'))
 actual={str(f.relative_to(r)) for v in range(1,16) for f in (r/'unicode'/str(v)).glob('sample*.html')}
 assert {x['path'] for x in catalog}==actual
 for path,digest in checksums.items():
  assert hashlib.sha256(z.read('assets/site/'+path)).hexdigest()==digest
  assert hashlib.sha256((r/path).read_bytes()).hexdigest()==digest
 print(f'PASS: {len(catalog)} programs; {len(checksums)} original files byte-identical; APK {apk.stat().st_size} bytes')
