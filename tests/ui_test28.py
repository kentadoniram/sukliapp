# "By group" view (stable vs volatile etc.), moving a ticker to a custom group, and adding a new income kind
from playwright.sync_api import sync_playwright
from pkhelp import choose, open_menu
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':390,'height':844},service_workers='block'); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(800)
    pg.goto('http://localhost:8123/#/invest'); pg.wait_for_selector('.nwcard')
    pg.click('[data-act=inv-new]'); pg.click('[data-k=coin]'); pg.wait_for_selector('#ic'); pg.fill('#ic [name=ex]','Binance'); pg.fill('#ic [name=coin]','ZQX'); pg.click('#ic .btn:not(.ghost)'); pg.wait_for_timeout(700)
    pg.click('[data-act=inv-group][data-v=risk]'); pg.wait_for_timeout(500)
    names=pg.evaluate("[...document.querySelectorAll('.exname')].map(e=>e.textContent.trim())"); print(names)
    ok('By group shows stablecoins and volatile coins', 'Stablecoins' in names and ('High-volatility coins' in names or 'Major coins' in names))
    ok('stablecoins listed before volatile', 'High-volatility coins' not in names or names.index('Stablecoins')<names.index('High-volatility coins'))
    ok('By group explained', 'stablecoins (steady value)' in pg.inner_text('#view'))
    # income: add a new kind
    open_menu(pg,'income'); pg.wait_for_selector('#ii')
    pg.click('#ii .pkbtn >> nth=1'); pg.wait_for_selector('.pk-add'); heads=pg.evaluate("[...document.querySelectorAll('.pk-list h3')].map(e=>e.textContent)"); print(heads[:6])
    ok('income kinds grouped', 'Crypto rewards' in heads and 'Dividends and interest' in heads)
    pg.click('.pk-add'); pg.wait_for_selector('input[name=v]'); pg.fill('input[name=v]','Lending interest'); pg.press('input[name=v]','Enter'); pg.wait_for_timeout(400)
    ok('new kind selected', 'Lending interest' in pg.inner_text('#ii .pkbtn >> nth=1'))
    ok('no errors', not errs); print(errs[:3]); b.close()
print(sum(res),'/',len(res))
