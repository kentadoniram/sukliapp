# v15.37: Scanner is a prominent block at the top of the burger menu, and is not in the bottom bar
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':390,'height':800})
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('.welcome')
    pg.click('[data-act=wz-old]'); pg.click('[data-act=start-empty]'); pg.wait_for_selector('#acct-form'); pg.fill('[name=name]','Wallet'); pg.click('#acct-form .btn'); pg.wait_for_timeout(800)
    print('PASS not in bottom bar' if pg.locator('.tabs .scanbtn').count()==0 else 'FAIL still in bottom bar')
    pg.click('[data-act=menu]'); pg.wait_for_timeout(300)
    ok=pg.locator('.dscan .dscanbtn').count()==2 and pg.locator('.dscan').is_visible()
    print('PASS menu scanner block' if ok else 'FAIL menu scanner block')
    pg.click('.dscan [data-act=wallet-scan]'); pg.wait_for_timeout(800)
    print('PASS opens' if pg.locator('.sheet').count() else 'FAIL opens')
    b.close()
