# v12at: glossary, real switch test, statement summary reachable
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':390,'height':844},service_workers='block'); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(800)
    pg.goto('http://localhost:8123/#/settings'); pg.wait_for_timeout(800); pg.evaluate("document.querySelectorAll('details').forEach(d=>d.open=true)")
    ok('real switch test present', pg.locator('#fb-realsw[switch]').count()==1)
    pg.evaluate("document.querySelector('[data-act=fb-test]').click()"); pg.wait_for_timeout(300); ok('buzz test explains itself', pg.locator('.toast').count()>=1)
    pg.evaluate("document.querySelector('[data-act=glossary]').click()"); pg.wait_for_selector('#gl-list dt'); n=pg.locator('#gl-list dt').count(); ok('glossary lists words %d'%n, n>=30)
    pg.fill('#gl-q','statement'); pg.wait_for_timeout(200); t=pg.inner_text('#gl-list'); ok('search finds Statement date and Billing period', 'Statement date' in t and 'Billing period' in t)
    pg.fill('#gl-q','kanji-none-xyz'); pg.wait_for_timeout(200); ok('empty search message', 'No word' in pg.inner_text('#gl-list'))
    pg.fill('#gl-q','税込'); pg.wait_for_timeout(200); ok('Japanese word has kanji, romaji, English', 'zeikomi' in pg.inner_text('#gl-list') and 'Tax included' in pg.inner_text('#gl-list'))
    ok('no errors', not errs); print(errs[:3]); b.close()
print(sum(res),'/',len(res))
