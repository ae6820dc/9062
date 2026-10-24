"""Verify the new Unicode release and preserve every previous APK digest."""
from pathlib import Path
import hashlib,json,os,re,subprocess,zipfile
project=Path(__file__).resolve().parent;repo=project.parent
sdk=Path(os.environ.get('ANDROID_HOME',str(Path.home()/'Android/Sdk')));tools=sdk/'build-tools/36.0.0'
apk=repo/'android-distributions/unicode-studio-1-11.apk'
previous={
 'android-distributions/mathematics-studio.apk':'dca33cdb3cdaa345f85b5e7235007d4963e1718e083bd5af1c78d6b8aed2b9d3',
 'android-distributions/unicode-studio.apk':'38da794ec263900b5836d745bf1a110e8e3aa050e6f2e5947f46a30882876018',
 'unicode/7/sample1.apk':'cfc50eea1afeee7e80edd18ae93ccf092567c0c87a24b930aa32756d32042525',
 'unicode/9/sample1.apk':'9604dafca7da510ab667d2f2ee246565a4191bcab5c4e5859f02441918281ce7'}
for path,digest in previous.items():assert hashlib.sha256((repo/path).read_bytes()).hexdigest()==digest,path
certs=[]
for file in (repo/'android-distributions/unicode-studio.apk',apk):
 output=subprocess.check_output([str(tools/'apksigner'),'verify','--verbose','--print-certs',str(file)],text=True)
 certs.append(re.search(r'Signer #1 certificate SHA-256 digest: (\w+)',output).group(1))
assert certs[0]==certs[1], 'Update signing identity differs'
badging=subprocess.check_output([str(tools/'aapt'),'dump','badging',str(apk)],text=True)
assert "package: name='io.github.ae6820dc.unicodestudio' versionCode='2' versionName='1.1'" in badging
assert "sdkVersion:'26'" in badging and "targetSdkVersion:'36'" in badging
assert 'android.permission.INTERNET' not in badging and 'application-debuggable' not in badging
with zipfile.ZipFile(repo/'android-distributions/unicode-studio.apk') as old,zipfile.ZipFile(apk) as archive:
 assert archive.testzip() is None
 catalog=json.loads(archive.read('assets/catalog.json'))
 assert len(catalog)==33 and catalog[:27]==json.loads(old.read('assets/catalog.json'))
 assert [p['path'] for p in catalog]==[f'unicode/{v}/sample{s}.html' for v in range(1,12) for s in range(1,4)]
 for key in ('id','programId'):
  assert len({p[key] for p in catalog})==33
 keys=[p['storageKey'] for p in catalog if p['storageKey']];assert len(keys)==len(set(keys))
 for p in catalog:assert len(p['programId'])==32
 digests=json.loads(archive.read('assets/source-checksums.json'));assert len(digests)==33
 for path,digest in digests.items():
  data=archive.read('assets/site/'+path)
  assert hashlib.sha256(data).hexdigest()==digest and data==(repo/path).read_bytes(),path
 for name in old.namelist():
  if name.startswith('assets/site/') or name=='assets/host.js':
   assert old.read(name)==archive.read(name),name
 assert archive.read('assets/host.js')==(project/'host.js').read_bytes()
 # Release resource optimization can rename paths; compare the resolved icon.
 old_badging=subprocess.check_output([str(tools/'aapt'),'dump','badging',str(repo/'android-distributions/unicode-studio.apk')],text=True)
 icon=lambda text:re.search(r"application-icon-160:'([^']+)'",text).group(1)
 assert old.read(icon(old_badging))==archive.read(icon(badging))
 resources=subprocess.check_output([str(tools/'aapt'),'dump','--values','resources',str(apk)],text=True)
 assert re.search(r'Key=0x0101020d.*\(boolean\) false',resources)
row=dict(file=str(apk.relative_to(repo)),package='io.github.ae6820dc.unicodestudio',versionCode=2,versionName='1.1',bytes=apk.stat().st_size,sha256=hashlib.sha256(apk.read_bytes()).hexdigest(),programs=33,originalAssets=33,signingCertificateSHA256=certs[1])
report_path=repo/'android-distributions/checksums.json';report=json.loads(report_path.read_text())
report=[x for x in report if x['file']!=row['file']]+[row]
report_path.write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(row,indent=2))
print('PASS: matching update signer; non-debug release; 33 original programs; original catalog prefix, assets, host and resources unchanged; every prior APK unchanged; no Internet permission')
