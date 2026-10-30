from pathlib import Path
import hashlib,json,os,re,subprocess,sys,zipfile
p=Path(__file__).resolve().parent;r=p.parent;apk=Path(sys.argv[1])
tools=Path(os.environ['ANDROID_HOME'])/'build-tools/36.0.0'
def tool(n,*a):return subprocess.check_output([str(tools/n),*map(str,a)],text=True)
def sha(b):return hashlib.sha256(b).hexdigest()
for path,digest in json.loads((p/'previous-apks.json').read_text()).items():assert sha((r/path).read_bytes())==digest,path
badging=tool('aapt','dump','badging',apk)
assert "package: name='io.github.ae6820dc.unicodestudio1619'" in badging
assert "application-label:'Unicode 2'" in badging
# A name-only rebuild must retain every code, asset, icon and manifest byte.
previous=r/'android-distributions/Unicode-Studio-16-19.apk'
with zipfile.ZipFile(apk) as new, zipfile.ZipFile(previous) as original:
 assert set(new.namelist())==set(original.namelist())
 for name in original.namelist():
  if name=='resources.arsc' or name.startswith('META-INF/'):continue
  assert new.read(name)==original.read(name),('Unexpected APK change',name)
assert 'application-debuggable' in badging and 'android.permission.INTERNET' not in badging
signature=tool('apksigner','verify','--verbose','--print-certs',apk)
old=r/'android-distributions/unicode-studio-1-15-v2.apk'
cert=lambda s:re.search(r'Signer #1 certificate SHA-256 digest: (\w+)',s)[1]
assert cert(signature)==cert(tool('apksigner','verify','--print-certs',old))
with zipfile.ZipFile(apk) as z:
 assert z.testzip() is None
 catalog=json.loads(z.read('assets/catalog.json'))
 expected={str(f.relative_to(r)) for v in range(16,20) for f in (r/'unicode'/str(v)).glob('sample*.html')}
 assert {x['path'] for x in catalog}==expected
 assert len(catalog)==len(expected)==len({x['programId'] for x in catalog})
 assert {n.removeprefix('assets/site/') for n in z.namelist() if n.startswith('assets/site/')}==expected
 for path in expected:assert z.read('assets/site/'+path)==(r/path).read_bytes()
 assert z.read('assets/host.js')==(p/'host.js').read_bytes()
 print(f'PASS: all {len(catalog)} discovered samples byte-identical; distinct debug package; signature verified; previous APKs unchanged; SHA-256 {sha(apk.read_bytes())}')
