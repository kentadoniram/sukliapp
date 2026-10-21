from playwright.sync_api import sync_playwright
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
    pg.goto(U+'#/invest'); pg.wait_for_selector('.nwcard'); pg.wait_for_timeout(300)
    t=pg.inner_text('#view'); ok('investments screen from imported crypto', 'Market value' in t and ('Bybit' in t or 'Binance' in t or 'Bitget' in t))
    print(t[:400].replace('\n',' | '))
    pg.click('[data-act=inv-new]'); pg.click('[data-k=coin]'); pg.wait_for_selector('#ic')
    pg.fill('#ic [name=ex]','Binance'); pg.fill('#ic [name=coin]','sol'); pg.fill('#ic [name=amt]','2.5'); pg.click('#ic .btn:not(.ghost)'); pg.wait_for_timeout(600)
    pg.click('[data-act=inv-new]'); pg.click('[data-k=coin]'); pg.wait_for_selector('#ic')
    pg.fill('#ic [name=ex]','Binance'); pg.fill('#ic [name=coin]','btc'); pg.fill('#ic [name=amt]','0.01'); pg.click('#ic .btn:not(.ghost)'); pg.wait_for_timeout(600)
    t=pg.inner_text('#view'); ok('both coins listed under Binance', 'SOL' in t and 'BTC' in t and 'Binance' in t)
    ok('coin balance shown', '2.5' in t)
    pg.click('[data-act=inv-new]'); pg.click('[data-k=acct]'); pg.wait_for_selector('#acct-form'); pg.fill('[name=name]','MP2 Pag-IBIG'); pg.fill('[name=open]','50000')
    ok('invtab ticked for investment type', pg.is_checked('[name=invtab]'))
    pg.click('#acct-form button:text-is("Save")'); pg.wait_for_timeout(700)
    t=pg.inner_text('#view'); ok('MP2 in other products', 'MP2 Pag-IBIG' in t and 'Investments and other products' in t)
    pg.goto(U+'#/settings'); pg.wait_for_selector('#arrange'); pg.click('#arrange [data-act=arr-tab-off][data-id=calendar]'); pg.click('#arrange [data-act=arr-tab-on][data-id=invest]'); pg.wait_for_timeout(400)
    ok('Invest tab can be put in the bar', 'Invest' in pg.inner_text('#tabs'))
    ok('no errors', not errs); print(errs[:5])
    b.close()
print(sum(res),'/',len(res))
