# Platform field: prefilled from the account, a pick list, and case-insensitive ("binance" = "Binance")
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
    pg.click('[data-act=inv-new]'); pg.click('[data-k=coin]'); pg.wait_for_selector('#ic')
    pg.fill('#ic [name=ex]','binance'); pg.fill('#ic [name=coin]','ZQX'); pg.click('#ic .btn:not(.ghost)'); pg.wait_for_timeout(700)
    names=pg.evaluate("[...document.querySelectorAll('.exname')].map(e=>e.textContent.trim())")
    ok('no duplicate platform spelling', len({n.lower() for n in names})==len(names)); print(names)
    ok('no lowercase-only binance group', 'binance' not in names)
    pg.click('.hold:has-text("ZQX")'); pg.wait_for_selector('#ad'); pg.click('[data-ad=edit], #ad [data-act=edit-acct], #ad button:has-text("Edit")'); pg.wait_for_selector('#acct-form')
    v=pg.eval_on_selector('#acct-form [name=exchange]','s=>s.value'); ok('platform prefilled on edit: '+v, v=='Binance')
    pg.click('#acct-form .pkbtn >> nth=1') if False else None
    ok('platform shown as pick list', pg.locator('#acct-form select[name=exchange]').evaluate('s=>s.style.display')=='none')
    pg.keyboard.press('Escape'); pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    pg.goto('http://localhost:8123/#/invest'); pg.wait_for_selector('.nwcard')
    pg.click('.hold:has-text("USDT") >> nth=0'); pg.wait_for_selector('#ad'); pg.click('[data-ad=edit]'); pg.wait_for_selector('#acct-form')
    v=pg.eval_on_selector('#acct-form [name=exchange]','s=>s.value'); ok('USDT account platform not blank: '+v, v!='')
    ok('no errors', not errs); print(errs[:3]); b.close()
print(sum(res),'/',len(res))
