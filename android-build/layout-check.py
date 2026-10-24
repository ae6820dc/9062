"""Chromium layout regression (not Android device testing). Requires Playwright.
Uses the exact app-injected JavaScript and original offline HTML.
"""
import json, re
from pathlib import Path
from playwright.sync_api import sync_playwright
root = Path(__file__).resolve().parent.parent
java = (root/'android-build/app/src/main/java/io/github/ae6820dc/unicode/MainActivity.java').read_text()
code = java.split('view.evaluateJavascript(', 1)[1].split(', null);', 1)[0]
script = ''.join(json.loads(s) for s in re.findall(r'"(?:[^"\\]|\\.)*"', code))
# Check each character's actual layout box, including wrap boundaries.
geometry = """() => {
 const h=document.querySelector('header'), text=h.firstChild, box=h.getBoundingClientRect();
 const rects=Array.from(text.textContent, (_,i)=>{const r=document.createRange();
 r.setStart(text,i);r.setEnd(text,i+1);const b=r.getBoundingClientRect();
 return {x:b.x,y:b.y,right:b.right,bottom:b.bottom,width:b.width,height:b.height};});
 return {text:h.textContent, width:innerWidth, box:{x:box.x,y:box.y,right:box.right,bottom:box.bottom},
 overflow:h.scrollWidth>h.clientWidth, rects};
}"""
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for edition in ('7','9'):
        html=(root/f'unicode/{edition}/sample1.html').read_text()
        expected=re.search(r'Program ID: ([0-9A-F]{32})</header>',html).group(1)
        page=browser.new_page()
        page.route('https://app.local/**',lambda r:r.fulfill(body=html,content_type='text/html; charset=utf-8'))
        page.goto('https://app.local/sample1.html')
        page.evaluate(script)
        for width,height in [(240,640),(280,640),(320,640),(360,800),(640,320),(800,1280),(1280,800)]:
            page.set_viewport_size({'width':width,'height':height})
            g=page.evaluate(geometry)
            assert g['text']=='Program ID: '+expected
            assert not g['overflow']
            for r in g['rects'][12:]:
                assert r['width']>0 and r['height']>0
                assert r['x']>=g['box']['x']-1 and r['right']<=g['box']['right']+1
                assert r['y']>=g['box']['y']-1 and r['bottom']<=g['box']['bottom']+1
            assert g['box']['right']<=width
        # Exercise the unmodified app while every request is served locally.
        assert page.locator('#marquee .glyph').count()==16
        page.select_option('#set','hu')
        page.fill('#speed','7.25')
        page.locator('#speed').dispatch_event('change')
        page.locator('#next').click()
        saved=page.evaluate('JSON.parse(localStorage.getItem(STORAGE_KEY))')
        assert saved['set']=='hu' and saved['speed']=='7.25'
        page.locator('#jumpButton').click()
        page.fill('#jumpInput','5')
        page.locator('#jumpGo').click()
        assert page.evaluate('index')==4
        page.locator('#prev').click()
        assert page.evaluate('index')==3
        page.locator('#next').click()
        assert page.evaluate('index')==4
        before=page.locator('#marquee').get_attribute('style')
        page.locator('#start').click()
        page.wait_for_timeout(200)
        assert page.locator('#marquee').get_attribute('style')!=before
        page.locator('#start').click()
        saved=page.evaluate('JSON.parse(localStorage.getItem(STORAGE_KEY))')
        page.reload()
        page.evaluate(script)
        assert page.evaluate('JSON.parse(localStorage.getItem(STORAGE_KEY))')==saved
        page.close()
        print(f'Unicode {edition}: exact ID {expected}; all character boxes within header at seven phone/tablet portrait/landscape sizes; controls, search, animation, reload persistence PASS')
    browser.close()
