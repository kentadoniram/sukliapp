from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':390,'height':800})
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('.welcome')
    pg.click('[data-act=wz-old]'); pg.click('[data-act=start-empty]'); pg.wait_for_selector('#acct-form'); pg.fill('[name=name]','Wallet'); pg.click('#acct-form .btn'); pg.wait_for_timeout(800)
    n=pg.locator('.tabs .scanbtn').count()
    print('PASS scan button' if n==1 else 'FAIL scan button missing')
    pg.click('.tabs .scanbtn'); pg.wait_for_timeout(300)
    t=pg.locator('.scanpick').inner_text() if pg.locator('.scanpick').count() else ''
    print('PASS chooser' if 'Receipt' in t and 'Pasmo' in t else 'FAIL chooser '+t)
    b.close()
