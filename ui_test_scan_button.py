# v15.37: one primary "Scan" button at the top of the burger menu; it asks Scan Receipt or Read PASMO
from playwright.sync_api import sync_playwright
res=[]
def ok(n,c): print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':390,'height':800})
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('.welcome')
    pg.click('[data-act=wz-old]'); pg.click('[data-act=start-empty]'); pg.wait_for_selector('#acct-form'); pg.fill('[name=name]','Wallet'); pg.click('#acct-form .btn'); pg.wait_for_timeout(800)
    ok('not in bottom bar', pg.locator('.tabs .scanbtn').count()==0)
    pg.click('[data-act=menu]'); pg.wait_for_timeout(300)
    ok('one Scan button, no card', pg.locator('.dscan .dscanbtn').count()==1 and pg.inner_text('.dscan .dscanbtn').strip()=='Scan' and pg.evaluate("getComputedStyle(document.querySelector('.dscan')).borderTopWidth")=='0px')
    ok('text centred', pg.evaluate("getComputedStyle(document.querySelector('.dscanbtn')).justifyContent")=='center')
    pg.click('.dscan .dscanbtn'); pg.wait_for_selector('.scanpick'); 
    t=pg.inner_text('.scanpick')
    ok('chooser has both', 'Scan Receipt' in t and 'Read PASMO' in t)
    pg.click('.scanpick [data-v=w]'); pg.wait_for_timeout(900)
    ok('Read PASMO opens', pg.locator('.sheet').count()>0 and pg.locator('.scanpick').count()==0)
    b.close()
