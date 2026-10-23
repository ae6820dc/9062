"""Verify actual APK signatures, manifests, original assets, and offline configuration."""
from pathlib import Path
import hashlib, os, re, subprocess, zipfile
root = Path(__file__).resolve().parent.parent
sdk = Path(os.environ.get('ANDROID_HOME', os.environ.get('ANDROID_SDK_ROOT', str(Path.home() / 'Android/Sdk'))))
tools = sdk / 'build-tools/36.0.0'
for edition in ('7', '9'):
    apk = root / f'unicode/{edition}/sample1.apk'
    html = root / f'unicode/{edition}/sample1.html'
    with zipfile.ZipFile(apk) as archive:
        assert archive.testzip() is None
        assert archive.read('assets/sample1.html') == html.read_bytes()
        assert 'classes.dex' in archive.namelist()
        dex = b''.join(archive.read(n) for n in archive.namelist() if re.fullmatch(r'classes[0-9]*\.dex', n))
        assert b'setJavaScriptEnabled' in dex and b'setDomStorageEnabled' in dex
        assert b'https://app.local/sample1.html' in dex
    subprocess.run([str(tools/'apksigner'), 'verify', '--verbose', '--print-certs', str(apk)], check=True)
    info = subprocess.check_output([str(tools/'aapt'), 'dump', 'badging', str(apk)], text=True)
    assert f"package: name='io.github.ae6820dc.unicode{edition}1'" in info
    assert "targetSdkVersion:'36'" in info
    assert "sdkVersion:'26'" in info
    assert 'android.permission.INTERNET' not in info
    manifest = subprocess.check_output([str(tools/'aapt'), 'dump', 'xmltree', str(apk), 'AndroidManifest.xml'], text=True)
    assert 'android:allowBackup' in manifest
    resources = subprocess.check_output([str(tools/'aapt'), 'dump', '--values', 'resources', str(apk)], text=True)
    # android.R.attr.windowFullscreen = 0x0101020d
    assert re.search(r'Key=0x0101020d.*\(boolean\) true', resources)
    print(f'{apk.relative_to(root)}: {apk.stat().st_size} bytes; SHA256 {hashlib.sha256(apk.read_bytes()).hexdigest()}')
print('PASS: distinct IDs, signatures, API 36 target, embedded unchanged HTML, fullscreen theme, no network permission.')
