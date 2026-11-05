# v12an: receipt scan screen: readings, quick fixes, bigger boxes, remembered corrections, tilted and very large photos
import subprocess, os
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
URL='http://localhost:8123/'
os.chdir('/home/claude/sukli')
from PIL import Image
im=Image.open('tests/receipts/life.jpg').convert('RGB')
im.rotate(5,expand=True,fillcolor=(90,70,50),resample=Image.BICUBIC).save('tests/receipts/_t_tilt.jpg',quality=90)
big=im.resize((4500,6000),Image.LANCZOS).rotate(90,expand=True); ex=Image.Exif(); ex[0x0112]=6; big.save('tests/receipts/_t_big.jpg',quality=80,exif=ex)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':402,'height':874},service_workers='block'); pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(URL); pg.wait_for_selector('.welcome'); pg.click('[data-act=wz-old]'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(800)
    def scan(text):
        pg.evaluate("(async()=>{const m=await import('/js/scan.js');m.openScan()})()"); pg.wait_for_selector('#rc-text',state='attached')
        pg.evaluate("document.querySelector('#rc-text').closest('details').open=true"); pg.fill('#rc-text',text); pg.click('[data-act=sc-text]'); pg.wait_for_selector('#scanform')
    scan('ライフ\n2026年10月19日 20:31\n牛乳 198\n卵 10個入 258\nサントリークラフトボス 117\n合計 573')
    ok('three items read', pg.locator('#sc-items .item').count()==3)
    rd=pg.inner_text('#sc-items .item >> nth=0 >> .sci-read')
    ok(f'reading under 牛乳: {rd!r}', 'gyuunyuu' in rd and 'milk' in rd)
    ok('romaji for katakana brand', 'santorii' in pg.inner_text('#sc-items .item >> nth=2 >> .sci-read'))
    pg.fill('#sc-name','ライフ'); pg.wait_for_timeout(100); ok('shop reading shown', 'raifu' in pg.inner_text('#sc-name-read') and 'Life' in pg.inner_text('#sc-name-read'))
    # live reading while typing, keyboard stays (no redraw)
    pg.click('#sc-items .item >> nth=0 >> .in-n'); pg.fill('#sc-items .item >> nth=0 >> .in-n','豆腐'); pg.wait_for_timeout(100)
    ok('reading follows typing', 'toufu' in pg.inner_text('#sc-items .item >> nth=0 >> .sci-read') and 'tofu' in pg.inner_text('#sc-items .item >> nth=0 >> .sci-read'))
    ok('field still focused after typing', pg.evaluate("document.activeElement.classList.contains('in-n')"))
    # Enter goes to the amount, then the next name
    pg.keyboard.press('Enter'); pg.wait_for_timeout(80); ok('Enter moves to the amount', pg.evaluate("document.activeElement.classList.contains('in-a')"))
    ok('amount is selected when entered', pg.evaluate("(()=>{const e=document.activeElement;return e.selectionStart===0&&e.selectionEnd===e.value.length&&e.value.length>0})()"))
    pg.keyboard.press('Enter'); ok('Enter moves to the next name', pg.evaluate("document.activeElement.classList.contains('in-n')") and pg.evaluate("document.activeElement.closest('.item').dataset.i")=='1')
    # sizes for fingers
    hs=pg.evaluate("(()=>{const q=(s)=>document.querySelector(s).getBoundingClientRect();return [q('#sc-items .in-n').height,q('#sc-items .in-a').height,q('#sc-items .iconbtn').height,q('#sc-items .pkbtn').height,q('#sc-items .iconbtn').width]})()")
    ok(f'boxes and buttons at least 44px {hs}', all(h>=44 for h in hs))
    ok('name box is the full card width', pg.evaluate("(()=>{const i=document.querySelector('#sc-items .in-n').getBoundingClientRect(),c=document.querySelector('#sc-items .item').getBoundingClientRect();return i.width>c.width-30})()"))
    # items do not add up: quick fixes
    pg.fill('#sc-total','700'); pg.dispatch_event('#sc-total','change'); pg.wait_for_timeout(300)
    ok('fix chips appear when items differ from total', pg.locator('.fixrow [data-act=sc-fixsum]').count()==1 and pg.locator('.fixrow [data-act=sc-fill]').count()>=1)
    pg.click('.fixrow [data-act=sc-fixsum]'); pg.wait_for_timeout(300)
    ok('make the total the items sum', pg.input_value('#sc-total')=='573' and 'add up' in pg.inner_text('#scanform'))
    pg.fill('#sc-total','653'); pg.dispatch_event('#sc-total','change'); pg.wait_for_timeout(300)
    pg.click('.fixrow [data-act=sc-fill] >> nth=0'); pg.wait_for_timeout(300)
    s=pg.evaluate("[...document.querySelectorAll('#sc-items .in-a')].reduce((x,e)=>x+(parseFloat(e.value)||0),0)")
    ok(f'put the difference on one item makes it add up ({s})', s==653 and '✓' in pg.inner_text('#scanform'))
    # hide/show readings
    pg.click('[data-act=sc-read]'); pg.wait_for_timeout(200); ok('readings can be hidden', pg.locator('.sci-read .rr').count()==0)
    pg.click('[data-act=sc-read]'); pg.wait_for_timeout(200); ok('and shown again', pg.locator('.sci-read .rr').count()>=2)
    # remembered corrections: rename a misread item, continue, scan the same misread again
    pg.fill('#sc-items .item >> nth=2 >> .in-n','サントリー クラフトボス'); pg.dispatch_event('#sc-items .item >> nth=2 >> .in-n','change')
    pg.click('[data-act=sc-use]'); pg.wait_for_timeout(500)
    fx=pg.evaluate("window.sukli.get().settings.ocrFixes||{}"); ok(f'correction remembered: {fx}', fx.get('サントリークラフトボス')=='サントリー クラフトボス')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelectorAll('.scrim').forEach(e=>e.remove())")
    scan('ライフ\n牛乳 198\nサントリークラフトボス 117\n合計 315')
    nm=pg.input_value('#sc-items .item >> nth=1 >> .in-n'); ok(f'same misread now fixed: {nm!r}', nm=='サントリー クラフトボス')
    ok('says it was fixed from an earlier correction', 'earlier correction' in pg.inner_text('#sc-items .item >> nth=1'))
    # a near-identical misread (one wrong letter) is fixed too
    pg.evaluate("document.querySelectorAll('.scrim').forEach(e=>e.remove())")
    scan('ライフ\n牛乳 198\nサントリークラフトボヌ 117\n合計 315')
    nm=pg.input_value('#sc-items .item >> nth=1 >> .in-n'); ok(f'close misread also fixed: {nm!r}', nm=='サントリー クラフトボス')
    # typing the read text back forgets the fix
    pg.evaluate("document.querySelectorAll('.scrim').forEach(e=>e.remove())")
    scan('ライフ\n牛乳 198\nサントリークラフトボス 117\n合計 315')
    pg.fill('#sc-items .item >> nth=1 >> .in-n','サントリークラフトボス'); pg.dispatch_event('#sc-items .item >> nth=1 >> .in-n','change'); pg.click('[data-act=sc-use]'); pg.wait_for_timeout(500)
    fx=pg.evaluate("window.sukli.get().settings.ocrFixes||{}"); ok(f'typing the read text back forgets that fix: {list(fx)}', 'サントリークラフトボス' not in fx)
    pg.evaluate("document.querySelectorAll('.scrim').forEach(e=>e.remove())")
    pg.evaluate("(async()=>{const m=await import('/js/scan.js');m.openScan()})()"); pg.wait_for_selector('[data-act=sc-fixes-clear]')
    pg.click('[data-act=sc-fixes-clear]'); pg.wait_for_timeout(300)
    ok('forget button clears them', not pg.evaluate("Object.keys(window.sukli.get().settings.ocrFixes||{}).length"))
    pg.evaluate("document.querySelectorAll('.scrim').forEach(e=>e.remove())")
    # very large photo with a sideways EXIF turn: decoded already small, upright
    r=pg.evaluate("""async()=>{const ri=await import('./js/receiptimg.js');const blob=await (await fetch('tests/receipts/_t_big.jpg')).blob();const s=await ri.loadSource(blob);const s2=await ri.loadSource(blob,{cap:1800});const info=await ri.jpegInfo(blob);return {w:s.width,h:s.height,sw:s2.width,sh:s2.height,info,mb:Math.round(blob.size/1e5)/10}}""")
    ok(f'27 MP photo with EXIF turn decodes to 2400x3200 upright {r}', r['w']==2400 and r['h']==3200 and r['sw']==1350 and r['sh']==1800 and r['info']['ori']==6)
    # tilted photo is straightened and read; the reader is let go after the window closes
    t=pg.evaluate("""async()=>{const m=await import('./js/scan.js');const blob=await (await fetch('tests/receipts/_t_tilt.jpg')).blob();const r=await m.readReceiptFile(blob);const p=r.parsed;return {tilt:r.tilt,total:p.total&&p.total.value,ok:p.check&&p.check.ok,n:p.items.length}}""")
    ok(f'5 degree tilt found and receipt read {t}', 4<=abs(t['tilt'])<=6.5 and t['total']==754 and t['ok'] and t['n']==4)
    ok('no page errors', not errs); print(errs)
    b.close()
for f in ('tests/receipts/_t_tilt.jpg','tests/receipts/_t_big.jpg'):
    try: os.remove(f)
    except Exception: pass
print(f'{sum(res)}/{len(res)} passed')
