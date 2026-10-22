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
    pg.goto(U+'#/invest'); pg.wait_for_selector('.nwcard')
    pg.click('[data-act=inv-new]'); pg.click('[data-k=coin]'); pg.wait_for_selector('#ic')
    pg.fill('#ic [name=ex]','Binance'); pg.fill('#ic [name=coin]','zzz'); pg.fill('#ic [name=amt]','0'); pg.click('#ic .btn:not(.ghost)'); pg.wait_for_timeout(600)
    def trade(side, qty, total, fee='', asset_text='ZZZ'):
        open_menu(pg,'trade'); pg.wait_for_selector('#tr'); choose(pg,'#tr [name=plat]',text='Binance')
        pg.click(f'[data-side={side}]')
        choose(pg,'#tr [name=asset]',text='Binance ZZZ')
        pg.fill('#tr [name=qty]',qty); pg.fill('#tr [name=total]',total)
        pg.dispatch_event('#tr [name=total]','input')
        if fee: pg.fill('#tr [name=fee]',fee)
        pg.click('#tr .btn:not(.ghost)'); pg.wait_for_timeout(400)
        if pg.locator('[data-yes]').count(): pg.click('[data-yes]'); pg.wait_for_timeout(300)
        pg.wait_for_timeout(500)
    trade('buy','10','30000','100')
    trade('sell','5','20000','50')
    t=pg.inner_text('#view'); print(t[:300].replace('\n',' | '))
    ok('realized gain card shows', 'Realized gains and losses' in t and ('+₱' in t))
    pg.click('.hold:has-text("ZZZ")'); pg.wait_for_selector('#ad'); pg.wait_for_timeout(300)
    h=pg.inner_text('#ad'); ok('holding page shows trades', 'Buy 10 ZZZ' in h and 'Sell 5 ZZZ' in h)
    pg.locator('#ad button.row[data-act=edit]').first.click(); pg.wait_for_selector('[data-del]'); ok('trade detail opens', 'not counted as spending' in pg.inner_text('.sheet >> nth=-1'))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    pg.goto(U+'#/home'); pg.wait_for_timeout(600)
    while pg.locator('[data-act=month][data-d="1"]:not([disabled])').count(): pg.click('[data-act=month][data-d="1"]'); pg.wait_for_timeout(250)
    pg.wait_for_timeout(1200); hx=pg.inner_text('#view'); ok('trading fee counted as an expense (group Fees)', 'Fees' in hx)
    ok('no errors', not errs); print(errs[:5])
    b.close()
print(sum(res),'/',len(res))
