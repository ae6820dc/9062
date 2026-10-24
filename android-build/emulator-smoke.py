"""Optional test against an already booted emulator; requires websocket-client.
Installs both APKs without clearing data. Uses only the debug WebView inspector.
Run on a dedicated test emulator: this changes app preferences for testing.
"""
import json, os, re, subprocess, sys, time, urllib.request
from pathlib import Path
import websocket
sdk=Path(os.environ['ANDROID_HOME']); adb=str(sdk/'platform-tools/adb')
root=Path(__file__).resolve().parent.parent

def run(*args): return subprocess.check_output([adb,*args],text=True).strip()
def launch(pkg):
    run('shell','am','start','-W','-n',pkg+'/io.github.ae6820dc.unicode.MainActivity')
    for _ in range(60):
        try:
            pid=run('shell','pidof',pkg).split()[0]
            run('forward','tcp:9222','localabstract:webview_devtools_remote_'+pid)
            opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
            pages=json.load(opener.open('http://127.0.0.1:9222/json',timeout=2))
            page=next(p for p in pages if p.get('url')=='https://app.local/sample1.html')
            ws=websocket.create_connection(page['webSocketDebuggerUrl'],timeout=60,suppress_origin=True,http_proxy_host=None)
            return ws
        except Exception: time.sleep(1)
    raise RuntimeError('WebView inspector not available for '+pkg)
seq=0
def evaluate(ws,expr,gesture=False):
    global seq
    seq+=1;ws.send(json.dumps({'id':seq,'method':'Runtime.evaluate','params':{'expression':expr,'returnByValue':True,'userGesture':gesture}}))
    while True:
        response=json.loads(ws.recv())
        if response.get('id')==seq:
            if 'exceptionDetails' in response.get('result',{}):raise RuntimeError(response)
            return response['result']['result'].get('value')
def wait_value(ws, expression, expected=True):
    deadline=time.monotonic()+30
    while time.monotonic()<deadline:
        if evaluate(ws,expression)==expected:return
        time.sleep(.5)
    raise AssertionError('Timed out waiting for '+expression)
assert run('get-serialno').startswith('emulator-'), 'Run this test on an Android emulator.'
packages=['io.github.ae6820dc.unicode71','io.github.ae6820dc.unicode91']
baseline=os.environ.get('BASELINE_APK_DIR')
if baseline:
    # Directory holds 7.apk and 9.apk from the previous repository revision.
    for v,pkg in zip(('7','9'),packages):
        print(run('install','-r',str(Path(baseline)/f'{v}.apk')))
        ws=launch(pkg)
        evaluate(ws,"$('set').value='hu';$('set').onchange();$('speed').value='7.25';$('speed').onchange();$('next').click();save();localStorage.setItem('android-update-probe','original-version');")
        print(pkg+': original header '+str(evaluate(ws,"document.querySelector('header').textContent")))
        previous=evaluate(ws,'localStorage.getItem(STORAGE_KEY)')
        ws.close();run('shell','am','force-stop',pkg)
        print(run('install','-r',str(root/f'unicode/{v}/sample1.apk')))
        ws=launch(pkg)
        assert evaluate(ws,"localStorage.getItem('android-update-probe')")=='original-version'
        assert evaluate(ws,'localStorage.getItem(STORAGE_KEY)')==previous
        evaluate(ws,"localStorage.removeItem('android-update-probe')")
        ws.close();run('shell','am','force-stop',pkg)
        print(pkg+': version 1 to version 2 update retains saved state PASS')
if '--skip-install' not in sys.argv:
    for v in ('7','9'): print(run('install','-r',str(root/f'unicode/{v}/sample1.apk')))
print(run('shell','cmd','connectivity','airplane-mode','enable'))
expected={}
for v,pkg,key in [('7',packages[0],'E71B4A90D63F2C85'),('9',packages[1],'A19F3D72C8E40B65')]:
    ws=launch(pkg)
    source=(root/f'unicode/{v}/sample1.html').read_text()
    program_id=re.search(r'Program ID: ([A-F0-9]{32})</header>',source).group(1)
    assert evaluate(ws,"document.querySelector('header').textContent")=='Program ID: '+program_id
    assert evaluate(ws,"!!document.getElementById('android-layout')")
    assert evaluate(ws,"document.querySelector('header').scrollWidth<=document.querySelector('header').clientWidth")
    # Native visible insets must contain both system bars on startup.
    window=run('shell','dumpsys','window',pkg)
    assert 'type=statusBars' in window and 'type=navigationBars' in window
    assert re.search(r'type=statusBars[^\n]*visible=true',window)
    assert re.search(r'type=navigationBars[^\n]*visible=true',window)
    assert evaluate(ws,"document.querySelectorAll('#marquee .glyph').length")==16
    assert evaluate(ws,"window.isSecureContext") is True
    result=evaluate(ws,"$('set').value='hu';$('set').onchange();$('speed').value='7.25';$('speed').onchange();$('next').click();JSON.parse(localStorage.getItem(STORAGE_KEY))")
    expected[pkg]=result
    assert result['set']=='hu' and result['speed']=='7.25'
    other='A19F3D72C8E40B65' if v=='7' else 'E71B4A90D63F2C85'
    assert evaluate(ws,f'localStorage.getItem("{other}")') is None
    evaluate(ws,"$('jumpButton').click()")
    run('shell','input','keyevent','4'); time.sleep(1)
    # First back may dismiss the IME; second closes the overlay.
    if evaluate(ws,"$('jumpOverlay').classList.contains('open')"):
        run('shell','input','keyevent','4');time.sleep(1)
    assert not evaluate(ws,"$('jumpOverlay').classList.contains('open')")
    before=evaluate(ws,"$('marquee').style.transform")
    assert evaluate(ws,"$('start').click();timer!==null")
    time.sleep(1)
    assert evaluate(ws,"$('marquee').style.transform") != before
    assert evaluate(ws,"$('start').click();timer===null")
    evaluate(ws,"$('fullscreen').click()",True);time.sleep(1)
    wait_value(ws,'!!document.fullscreenElement')
    run('shell','input','keyevent','4');time.sleep(1)
    wait_value(ws,'!!document.fullscreenElement',False)
    window=run('shell','dumpsys','window',pkg)
    assert re.search(r'type=statusBars[^\n]*visible=true',window)
    assert re.search(r'type=navigationBars[^\n]*visible=true',window)
    expected[pkg]=evaluate(ws,'JSON.parse(localStorage.getItem(STORAGE_KEY))')
    ws.close();run('shell','am','force-stop',pkg)
    ws=launch(pkg)
    assert evaluate(ws,'JSON.parse(localStorage.getItem(STORAGE_KEY))')==expected[pkg]
    ws.close()
    print(pkg+': offline render, controls, animation, fullscreen, Back, isolated storage, force-stop/relaunch PASS')
for pkg in packages: assert pkg in run('shell','pm','list','packages',pkg)
print('Both packages installed simultaneously.')
# Update over the installed APKs without uninstalling, then check saved state.
for v,pkg in zip(('7','9'),packages):
    run('shell','am','force-stop',pkg)
    print(run('install','-r',str(root/f'unicode/{v}/sample1.apk')))
    ws=launch(pkg)
    assert evaluate(ws,'JSON.parse(localStorage.getItem(STORAGE_KEY))')==expected[pkg]
    ws.close()
    print(pkg+': in-place reinstall preserves localStorage PASS')
if '--skip-reboot' in sys.argv:
    print('PASS (emulator only; reboot and physical-device tests not performed)');sys.exit(0)
print('Rebooting emulator to verify persistence.')
run('reboot');run('wait-for-device')
for _ in range(180):
    if run('shell','getprop','sys.boot_completed')=='1':break
    time.sleep(1)
else:raise RuntimeError('Reboot timed out')
for pkg in packages:
    ws=launch(pkg)
    assert evaluate(ws,'JSON.parse(localStorage.getItem(STORAGE_KEY))')==expected[pkg]
    ws.close();print(pkg+': reboot persistence PASS')
print('PASS (emulator only; no physical device tested)')
