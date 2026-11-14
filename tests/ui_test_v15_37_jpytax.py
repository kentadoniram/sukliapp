from playwright.sync_api import sync_playwright
def ok(n,c): print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':402,'height':874})
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('.welcome')
    pg.click('[data-act=wz-old]'); pg.click('[data-act=start-empty]'); pg.wait_for_selector('#acct-form'); pg.fill('[name=name]','Wallet'); pg.click('#acct-form .btn'); pg.wait_for_timeout(800)
    pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.accounts[0].cur='JPY'})})()"); pg.wait_for_timeout(500)
    pg.goto('http://localhost:8123/#/ledger'); pg.wait_for_timeout(800)
    pg.click('.fab'); pg.wait_for_selector('#entry'); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelector('[data-e=items-on]').click()"); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelector('[data-e=item-tax]')&&document.querySelector('[data-e=item-tax]').click()"); pg.wait_for_timeout(300)
    t=pg.evaluate("[...document.querySelectorAll('.itax .seg button, .taxchips button')].map(x=>x.textContent.trim())")
    print(t); ok('8% first', len(t)>=2 and t[0].startswith('8'))
    b.close()
