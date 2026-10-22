from playwright.sync_api import sync_playwright
from pkhelp import choose, open_menu
CSV='/home/claude/Transactions.csv'
errs=[]; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
U='http://localhost:8123/index.html'
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},locale='en-US',service_workers='block'); pg=ctx.new_page()
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.on('console',lambda m: errs.append(m.text) if m.type=='error' and 'ERR_TUNNEL' not in m.text else None)
    pg.goto(U); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(800)
    pg.goto(U+'#/invest'); pg.wait_for_selector('[data-act=inv-new]'); pg.click('[data-act=inv-new]'); pg.click('[data-k=coin]'); pg.wait_for_selector('#ic')
    choose(pg,'#ic [name=type]',value='stock'); pg.fill('#ic [name=ex]','Moomoo'); pg.fill('#ic [name=coin]','NVDA'); pg.fill('#ic [name=name]','NVIDIA'); choose(pg,'#ic [name=market]',value='NASDAQ'); pg.fill('#ic [name=quote]','PHP'); pg.fill('#ic [name=price]','7000')
    pg.click('#ic button:text-is("Add asset")'); pg.wait_for_timeout(700)
    t=pg.inner_text('#view'); ok('stock added under its platform', 'Moomoo' in t and 'NVDA' in t and 'NASDAQ' in t)
    # Korean / Japanese tickers
    for ex,tk,mk in [('Kiwoom','005930','KRX (Korea)'),('SBI Securities','7203','TSE (Tokyo)')]:
        pg.click('[data-act=inv-new]'); pg.click('[data-k=coin]'); pg.wait_for_selector('#ic'); choose(pg,'#ic [name=type]',value='stock'); pg.fill('#ic [name=ex]',ex); pg.fill('#ic [name=coin]',tk); pg.select_option('#ic [name=market]',mk); pg.fill('#ic [name=quote]','JPY' if tk=='7203' else 'KRW'); pg.click('#ic button:text-is("Add asset")'); pg.wait_for_timeout(600)
    t=pg.inner_text('#view'); ok('Korean and Japanese tickers listed', '005930' in t and '7203' in t and 'Kiwoom' in t and 'SBI' in t)
    # buy 2 NVDA at 7000 paying from first account
    open_menu(pg,'trade'); pg.wait_for_selector('#tr'); choose(pg,'#tr [name=plat]',text='Moomoo'); choose(pg,'#tr [name=asset]',text='NVDA')
    pg.fill('#tr [name=qty]','2'); pg.fill('#tr [name=price]','7000'); pg.fill('#tr [name=fee]','50'); pg.click('#tr button:text-is("Record")'); pg.wait_for_timeout(900)
    pg.goto(U+'#/invest'); pg.wait_for_timeout(500); t=pg.inner_text('#view')
    ok('row shows amount, paid and value', '2 NVDA' in t.replace('\n',' ') and 'paid 14,000' in t)
    pg.click('[data-act=inv-group][data-v=type]'); pg.wait_for_timeout(500); t=pg.inner_text('#view'); ok('group by asset type', 'Stocks' in t and 'Cryptocurrency' in t)
    ok('tickers and prices card', 'Tickers and prices' in t)
    ok('no errors', not errs); print(errs[:5])
    b.close()
print(sum(res),'/',len(res))
