# v15.59: whole-card flip; month picker survives a browser whose composedPath() is empty and a rebuilt-target tap (iPhone Safari worst case)
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'
def ok(n,c): print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch()
    ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block',has_touch=True,is_mobile=True); pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.add_init_script("Event.prototype.composedPath=function(){return []}")
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached'); pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000)
    pg.goto('http://localhost:8123/#/home'); pg.wait_for_timeout(1500)
    pg.tap('.mscard'); pg.wait_for_timeout(200); ok('opens by tap', pg.locator('.mspanel:visible').count()==1)
    for i in range(3):
        pg.tap('.msyear [data-d="-1"]'); pg.wait_for_timeout(200)
    ok('previous-year arrow x3 keeps it open %s'%pg.inner_text('.msyear b'), pg.locator('.mspanel:visible').count()==1 and pg.inner_text('.msyear b')==str(int(pg.evaluate("new Date().getFullYear()"))-3))
    pg.tap('.msyear [data-d="1"]'); pg.wait_for_timeout(150); ok('next-year works and stays open', pg.locator('.mspanel:visible').count()==1)
    ok('the tapped arrow is the same element (not rebuilt)', pg.evaluate("(()=>{const a=document.querySelector('.msyear [data-d=\"-1\"]');a.dataset.mark='1';a.click();return document.querySelector('.msyear [data-d=\"-1\"]').dataset.mark==='1'})()"))
    pg.tap('.mscard'); pg.wait_for_timeout(250); ok('same arrow closes it', pg.locator('.mspanel:visible').count()==0 and pg.get_attribute('.mscard','aria-expanded')=='false')
    pg.tap('.mscard'); pg.wait_for_timeout(200); pg.tap('.msm:not([disabled])'); pg.wait_for_timeout(600); ok('picking a month works and closes', pg.locator('.mspanel:visible').count()==0)
    # whole card flip
    g=pg.evaluate("(()=>{const c=document.querySelector('.main-home-card'),cs=getComputedStyle(c),f=getComputedStyle(c.querySelector('.sc-front')),k=getComputedStyle(c.querySelector('.sc-back'));return {cbg:cs.backgroundImage,fbg:f.backgroundImage!=='none',kbg:k.backgroundImage!=='none',fr:f.borderRadius,fs:f.boxShadow!=='none',ks:k.boxShadow!=='none',ts:getComputedStyle(c.querySelector('.sc-inner')).transformStyle}})()")
    ok('each face is a complete gradient card, wrapper is plain %s'%g, g['cbg']=='none' and g['fbg'] and g['kbg'] and g['fs'] and g['ks'] and g['ts']=='preserve-3d')
    h0=pg.evaluate("document.querySelector('.sc-front').getBoundingClientRect().height")
    pg.tap('.sc-front .sc-swap'); pg.wait_for_timeout(250)
    mid=pg.evaluate("getComputedStyle(document.querySelector('.sc-inner')).transform"); ok('the card itself is rotating %s'%mid[:36], mid.startswith('matrix3d') and mid!='none')
    pg.wait_for_timeout(900)
    ok('lands on Net worth with the same size', pg.locator('.main-home-card.flipped').count()==1 and abs(pg.evaluate("document.querySelector('.sc-back').getBoundingClientRect().height")-h0)<1 and 'Net worth' in pg.inner_text('.sc-back'))
    pg.tap('.sc-back .sc-swap'); pg.wait_for_timeout(1000); ok('flips back', pg.locator('.main-home-card.flipped').count()==0)
    ok('no page errors %s'%errs, not errs)
