"""Verify exact V2 inventory, original assets, signing, icon and prior releases."""
from pathlib import Path
import hashlib,json,os,re,subprocess,sys,zipfile
p=Path(__file__).resolve().parent;r=p.parent
apk=Path(sys.argv[1])
tools=Path(os.environ['ANDROID_HOME'])/'build-tools/36.0.0'
def tool(name,*args):return subprocess.check_output([str(tools/name),*map(str,args)],text=True)
def sha(data):return hashlib.sha256(data).hexdigest()
for path,digest in json.loads((p/'previous-apks.json').read_text()).items():
 assert sha((r/path).read_bytes())==digest,('Previous APK changed',path)
badging=tool('aapt','dump','badging',apk)
assert "package: name='io.github.ae6820dc.unicodestudio' versionCode='4' versionName='2.0'" in badging
assert "application-label:'Unicode Studio'" in badging
assert "sdkVersion:'26'" in badging and "targetSdkVersion:'36'" in badging
assert 'android.permission.INTERNET' not in badging and 'application-debuggable' not in badging
signature=tool('apksigner','verify','--verbose','--print-certs',apk)
cert=lambda s:re.search(r'Signer #1 certificate SHA-256 digest: (\w+)',s)[1]
oldapk=r/'android-distributions/unicode-studio-1-15-40666514957-1.apk'
assert cert(signature)==cert(tool('apksigner','verify','--print-certs',oldapk))
with zipfile.ZipFile(apk) as z,zipfile.ZipFile(oldapk) as old:
 assert z.testzip() is None
 catalog=json.loads(z.read('assets/catalog.json'));checksums=json.loads(z.read('assets/source-checksums.json'))
 expected=[f'unicode/{v}/sample{s}.html' for v in range(1,16) for s in range(1,(12 if v>=12 else 3)+1)]
 actual={str(f.relative_to(r)) for v in range(1,16) for f in (r/'unicode'/str(v)).glob('sample*.html')}
 assert len(catalog)==81 and [x['path'] for x in catalog]==expected and set(expected)==actual
 assert len([x for x in catalog if x['group']=='Unicode 12'])==12
 assert len({x['id'] for x in catalog})==81 and len({x['programId'] for x in catalog})==81
 previous={x['id']:x for x in json.loads(old.read('assets/catalog.json'))}
 for row in catalog:
  if row['id'] in previous:assert row==previous[row['id']],row['id']
 for path,digest in checksums.items():
  assert sha(z.read('assets/site/'+path))==digest
  assert sha((r/path).read_bytes())==digest
 assert set(expected)<=checksums.keys()
 assert z.read('assets/host.js')==old.read('assets/host.js')==(p/'host.js').read_bytes()
 icon=lambda b:re.search(r"application-icon-160:'([^']+)'",b)[1]
 assert z.read(icon(badging))==old.read(icon(tool('aapt','dump','badging',oldapk)))
 print(f'PASS: 81 programs; Unicode 12 has 12 samples; {len(checksums)} original files byte-identical; prior catalog identities, host, launcher icon and all previous APKs unchanged; matching signer; valid non-debug Android package; target API 36; no Internet permission; APK {apk.stat().st_size} bytes; SHA-256 {sha(apk.read_bytes())}')
