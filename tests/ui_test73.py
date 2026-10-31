# v13.14: real switches over keypad keys, Save and + (iPhone user agent); taps still work
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
UA='Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1'
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block',user_agent=UA,has_touch=True); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    pg.goto('http://localhost:8123/#/home'); pg.wait_for_timeout(500)
    ok('+ has a real switch', pg.locator('.fab > input.hsw[switch]').count()==1)
    pg.click('.fab'); pg.wait_for_selector('#entry'); pg.wait_for_timeout(500)
    ok('Save has a real switch', pg.locator('#btns .btn > input.hsw').count()>=1)
    pg.click('[data-e=calc]'); pg.wait_for_timeout(400)
    n=pg.locator('.keypad button > input.hsw').count(); ok('keypad keys have real switches: %s'%n, n>=10)
    pg.locator('.keypad button:has-text("7")').first.tap(); pg.wait_for_timeout(200); pg.locator('.keypad button:has-text("5")').first.tap(); pg.wait_for_timeout(300)
    ok('keypad still types: '+pg.input_value('#f-amount'), pg.input_value('#f-amount').replace(',','') in ('75',))
    ok('real switch resets after tap', pg.evaluate("[...document.querySelectorAll('.hsw')].every(i=>!i.checked)"))
    pg.evaluate("localStorage.setItem('sukli-fb', JSON.stringify({overlay:false}))"); pg.reload(); pg.wait_for_selector('.fab'); pg.wait_for_timeout(500)
    ok('off in Settings: no switches', pg.locator('.hsw').count()==0)
    ok('no errors %s'%errs, not errs)
    b2=b.new_context(viewport={'width':390,'height':844},service_workers='block'); q=b2.new_page(); q.goto('http://localhost:8123/'); q.wait_for_timeout(800)
    ok('not on non-iPhone browsers', q.locator('.hsw').count()==0)
print('fails',res.count(False))
