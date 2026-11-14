from playwright.sync_api import sync_playwright
import pkhelp; pkhelp.patch()
CSV='/home/claude/Transactions.csv'
errs=[]; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},locale='en-US',service_workers='block'); pg=ctx.new_page()
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.on('console',lambda m: errs.append(m.text) if m.type=='error' and 'ERR_TUNNEL' not in m.text and 'Failed to load resource' not in m.text else None)
    pg.goto('http://localhost:8123/index.html'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(600)
    # ---- name map
    pg.goto('http://localhost:8123/index.html#/settings'); pg.wait_for_selector('[data-act=nm-map]',state='attached'); pg.evaluate("document.querySelectorAll('details').forEach(d=>d.open=true)"); pg.wait_for_timeout(200)
    pg.click('[data-act=nm-map]'); pg.wait_for_selector('svg.namemap'); 
    ok('name map draws', pg.locator('svg.namemap circle').count()>=2)
    pg.fill('#nmq','Life Tsukagoshi Annex'); pg.press('#nmq','Enter'); pg.evaluate("document.getElementById('nmq').dispatchEvent(new Event('change'))"); pg.wait_for_timeout(300)
    ok('try-a-name explains path', 'Life Tsukagoshi' in pg.inner_text('.sheet-body') and '%' in pg.inner_text('.sheet-body'))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    # ---- scanner via menu
    pg.goto('http://localhost:8123/index.html#/home'); pg.wait_for_timeout(400)
    pg.click('button[aria-label="Open menu"], .menubtn, [data-act=menu]'); pg.wait_for_selector('.drawer')
    pg.evaluate("document.querySelector('[data-act=scan]').click()"); pg.wait_for_selector('#rc-file',state='attached',timeout=5000)
    ok('scan sheet opens from menu', True)
    # the reading of a receipt picture is not tested here: the OCR is being replaced (PaddleOCR)
    pg.keyboard.press('Escape'); print('ERRS',errs)
    ok('no script errors', not errs)
    b.close()
print(sum(res),'/',len(res))
