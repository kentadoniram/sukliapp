# v15.35: Compare Rates page: sources and dates on every row, amount shows yearly interest
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    pg.evaluate("location.hash='#/rates'"); pg.wait_for_selector('.rcrow',timeout=5000); pg.wait_for_timeout(200)
    n=pg.locator('.rcrow').count(); ok('rows listed %d'%n, n>=5)
    ok('every row has a source link and a date', pg.locator('.rcrow a[href^="https://"]').count()==n and pg.locator('.rcrow', has_text='Read 20').count()==n)
    t=pg.inner_text('.rcrow'); ok('MP2 7.12%% of 100,000 = 7,120 %r'%t[-40:], '7,120' in t)
    pg.fill('#rc-amt','200000'); pg.wait_for_timeout(200); ok('amount change updates', '14,240' in pg.inner_text('.rcrow'))
    ok('old rows are flagged (page is read today)', 'old, please check' in pg.inner_text('.rclist'))
    ok('no errors %s'%errs, not errs)
    b.close()
print('fails',res.count(False))
