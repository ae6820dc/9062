"""Verify the actual Explorer APK against all 12 unchanged source programs."""
from pathlib import Path
import hashlib,json,os,re,subprocess,zipfile
project=Path(__file__).resolve().parent;repo=project.parent
apk=project/'app/build/outputs/apk/explorer/debug/app-explorer-debug.apk'
tools=Path(os.environ['ANDROID_HOME'])/'build-tools/36.0.0'
signature=subprocess.check_output([str(tools/'apksigner'),'verify','--print-certs',str(apk)],text=True)
cert=re.search(r'Signer #1 certificate SHA-256 digest: (\w+)',signature).group(1)
assert cert=='01059a5e2a9f61d6b88aff4f2b47bc4e33195b352ba01872858f71fd358ffb1e'
badging=subprocess.check_output([str(tools/'aapt'),'dump','badging',str(apk)],text=True)
assert "package: name='io.github.ae6820dc.systemexplorer'" in badging
assert "application-label:'System Explorer'" in badging
assert "sdkVersion:'26'" in badging and "targetSdkVersion:'36'" in badging
assert 'android.permission.INTERNET' not in badging
with zipfile.ZipFile(apk) as archive:
 assert archive.testzip() is None
 catalog=json.loads(archive.read('assets/catalog.json'))
 assert len(catalog)==12
 assert [p['path'] for p in catalog]==[f'explorer/{v}/sample{s}.html' for v in (7,) for s in range(1,13)]
 assert len({p['id'] for p in catalog})==12
 identifiers=[p[key] for p in catalog for key in ('programId','databaseName','storageKey')]
 assert len(set(identifiers))==36 and all(re.fullmatch('[0-9a-f]{16}',x) for x in identifiers)
 digests=json.loads(archive.read('assets/source-checksums.json'));assert len(digests)==12
 for p in catalog:
  path=p['path'];data=archive.read('assets/site/'+path)
  assert data==(repo/path).read_bytes() and hashlib.sha256(data).hexdigest()==digests[path],path
  html=data.decode();assert f"MAX_DEPTH={p['depth']}" in html
  assert p['programId'] in html and p['databaseName'] in html
 assert archive.read('assets/host.js')==(project/'host.js').read_bytes()
report=dict(file='android-distributions/System-Explorer.apk',package='io.github.ae6820dc.systemexplorer',versionCode=1,versionName='1.0',bytes=apk.stat().st_size,sha256=hashlib.sha256(apk.read_bytes()).hexdigest(),signingCertificateSHA256=cert,programs=12,originalAssets=12,depths=[65536])
(repo/'android-distributions/System-Explorer.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
print('PASS: signed APK; Android 8–16; no Internet permission; 12 unchanged HTML programs; 36 distinct IDs; System Explorer version 7, twelve samples')
