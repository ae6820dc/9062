"""Optional test against an already booted emulator; requires websocket-client.
Installs both APKs without clearing data. Uses only the debug WebView inspector.
Run on a dedicated test emulator: this changes app preferences for testing.
"""
import json, os, subprocess, time, urllib.request
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
            ws=websocket.create_connection(page['webSocketDebuggerUrl'],timeout=10,suppress_origin=True,http_proxy_host=None)
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
packages=['io.github.ae6820dc.unicode71','io.github.ae6820dc.unicode91']
for v in ('7','9'): print(run('install','-r',str(root/f'unicode/{v}/sample1.apk')))
print(run('shell','cmd','connectivity','airplane-mode','enable'))
expected={}
for v,pkg,key in [('7',packages[0],'E71B4A90D63F2C85'),('9',packages[1],'A19F3D72C8E40B65')]:
    ws=launch(pkg)
    assert evaluate(ws,"document.querySelector('header').textContent").startswith('Program ID:')
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
    assert evaluate(ws,"$('start').click();timer!==null")
    time.sleep(1)
    assert evaluate(ws,"$('start').click();timer===null")
    evaluate(ws,"$('fullscreen').click()",True);time.sleep(1)
    assert evaluate(ws,'!!document.fullscreenElement')
    run('shell','input','keyevent','4');time.sleep(1)
    assert not evaluate(ws,'!!document.fullscreenElement')
    expected[pkg]=evaluate(ws,'JSON.parse(localStorage.getItem(STORAGE_KEY))')
    ws.close();run('shell','am','force-stop',pkg)
    ws=launch(pkg)
    assert evaluate(ws,'JSON.parse(localStorage.getItem(STORAGE_KEY))')==expected[pkg]
    ws.close()
    print(pkg+': offline render, controls, animation, fullscreen, Back, isolated storage, force-stop/relaunch PASS')
for pkg in packages: assert pkg in run('shell','pm','list','packages',pkg)
print('Both packages installed simultaneously. Rebooting emulator to verify persistence.')
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
