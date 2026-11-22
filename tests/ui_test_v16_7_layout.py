from playwright.sync_api import sync_playwright
from tests.invnavhelp import go_invest
def ok(n,c): print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch()
    for d in ('theme1','legacy'):
        c=b.new_context(service_workers='block',viewport={'width':390,'height':844}); pg=c.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached'); pg.set_input_files('#first-file','/home/claude/Transactions.csv'); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(700)
        if d=='legacy': pg.evaluate("localStorage.setItem('sukli-look', JSON.stringify({design:'legacy'}))"); pg.reload(); pg.wait_for_timeout(1500)
        n=d+': '
        pg.goto('http://localhost:8123/#/accounts'); pg.wait_for_timeout(1500)
        st=pg.evaluate("(()=>{const g=document.querySelector('.topgrp.assets'),cs=getComputedStyle(g),c=g.querySelector(':scope > .coll'),cc=getComputedStyle(c);return {bw:cs.borderTopWidth,bg:cs.backgroundImage+cs.backgroundColor,pad:cs.paddingTop,card:cc.borderTopWidth,grad:cc.backgroundImage}})()")
        ok(n+'Assets header has no card around it %s'%st, st['bw']=='0px' and st['pad']=='0px' and ('rgba(0, 0, 0, 0)' in st['bg']))
        ok(n+'category is the first card (.topgrp > .coll)', st['card']!='0px')
        if d=='theme1': ok(n+'category card keeps the gradient', 'gradient' in st['grad'])
        go_invest(pg,None,sec='overview',wait=1500)
        flat=pg.evaluate("({flat:!!document.querySelector('.dashcard.flat'),colls:document.querySelectorAll('.invpage .coll').length})")
        if d=='theme1': ok(n+'Overview: flat Performance wrapper (sections are cards, v16.18) %s'%flat, flat['flat'])
        else: ok(n+'Overview keeps the legacy card %s'%flat, not flat['flat'] and flat['colls']>=1)
        ok(n+'no page errors %s'%errs, not errs); c.close()
