from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'
errs=[]; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},locale='en-US',service_workers='block'); pg=ctx.new_page()
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.on('console',lambda m: errs.append(m.text) if m.type=='error' and 'ERR_TUNNEL' not in m.text else None)
    pg.goto('http://localhost:8123/index.html'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(600)
    pg.goto('http://localhost:8123/index.html#/settings'); pg.wait_for_selector('[data-act=nm-review]')
    pg.click('[data-act=nm-review]'); pg.wait_for_selector('.cmp',timeout=5000)
    n=pg.locator('.cmp').count(); ok('review shows compare cards',n>0)
    t=pg.inner_text('.cmp'); ok('card shows evidence and similarity','×' in t and 'Looks alike' in t)
    ok('three answers', all(x in t for x in ['Same','Related','Different']))
    a=pg.locator('.cmp').first.get_attribute('data-a'); b2=pg.locator('.cmp').first.get_attribute('data-b')
    pg.click('.cmp [data-act=nm-rel]'); pg.wait_for_selector('[data-act=nm-relw]')
    ok('strength chips appear', pg.locator('[data-act=nm-relw]').count()==3)
    pg.click('[data-act=nm-relw][data-w="0.85"]'); pg.wait_for_timeout(200)
    rules=pg.evaluate("JSON.parse(localStorage.getItem('sukli-db')||'null')") if False else None
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    pg.goto('http://localhost:8123/index.html#/settings'); pg.reload(); pg.wait_for_selector('[data-act=nm-map]')
    ok('settings lists related with closeness', '85% close' in pg.inner_text('body'))
    pg.click('[data-act=nm-map]'); pg.wait_for_selector('svg.namemap')
    print('ERRS',errs); ok('no script errors', not errs)
    b.close()
print(sum(res),'/',len(res))
