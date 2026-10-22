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
    pg.goto(U+'#/accounts'); pg.wait_for_selector('[data-aview=group]'); ok('compact dropdown filters', pg.locator('.aview.compact select').count()==2 and pg.locator('.aview .seg').count()==0)
    pg.goto(U+'#/invest'); pg.wait_for_selector('[data-act=inv-new]')
    ok('hero text laid out', pg.evaluate("getComputedStyle(document.querySelector('.nwmain')).display")=='grid' and 'updated' in pg.inner_text('.nwmain').lower() or 'Live' in pg.inner_text('.nwmain'))
    pg.click('[data-act=inv-new]'); pg.click('[data-k=coin]'); pg.wait_for_selector('#ic')
    print(pg.locator('.chip.plat b').count(), repr(pg.inner_text('.platlist')[:80])); ok('platform chips bold with history first', pg.locator('.chip.plat b').count()>5 and 'You used' in pg.inner_text('.platlist'))
    pg.locator('.chip.plat', has_text='Moomoo').click(); ok('chip fills platform', pg.input_value('#ic [name=ex]')=='Moomoo')
    pg.select_option('#ic [name=type]','stock'); pg.fill('#ic [name=coin]','NVDA'); pg.select_option('#ic [name=market]','NASDAQ'); pg.fill('#ic [name=quote]','PHP'); pg.fill('#ic [name=price]','7000'); pg.fill('#ic [name=amt]','2')
    pg.click('#ic button:text-is("Add asset")'); pg.wait_for_timeout(700)
    # set price twice -> history
    pg.click('[data-act=inv-price][data-sym=NVDA]'); pg.fill('.sheet input[name=v]','7700'); pg.click('.sheet .btn:not(.ghost)'); pg.wait_for_timeout(500)
    pg.locator('[data-act=inv-ticker][data-sym=NVDA]').click(); pg.wait_for_selector('.sheet svg.chart, .sheet .calfacts'); t=pg.inner_text('.sheet >> nth=-1')
    ok('price history lists the update', 'you set' in t and '7,700' in t)
    pg.click('.sheet [data-x]'); pg.wait_for_timeout(300)
    ok('performance card needs cost: asks "I paid"', 'I paid' in pg.inner_text('#view'))
    pg.click('[data-act=inv-cost] >> nth=0'); pg.fill('.sheet input[name=v]','10000'); pg.click('.sheet .btn:not(.ghost)'); pg.wait_for_timeout(600)
    t=pg.inner_text('#view'); ok('performance shows gain vs paid', 'Performance' in t and 'paid ₱10,000' in t and '%' in t)
    # income
    pg.click('#view [data-act=inv-income] >> nth=0'); pg.wait_for_selector('#ii'); pg.select_option('#ii [name=asset]', label=pg.eval_on_selector('#ii [name=asset]','s=>[...s.options].find(o=>o.textContent.includes("NVDA")).textContent')); pg.select_option('#ii [name=type]','Dividend'); pg.fill('#ii [name=amt]','0.25'); pg.click('#ii button:text-is("Save")'); pg.wait_for_timeout(700)
    t=pg.inner_text('#view'); ok('investment income card', 'Investment income' in t and 'Dividend' in t)
    # prediction
    pg.click('[data-act=inv-predict] >> nth=0'); pg.wait_for_selector('#ip'); pg.select_option('#ip [name=asset]','NVDA'); pg.fill('#ip [name=price]','9000'); pg.fill('#ip [name=quote]','PHP'); pg.click('#ip button:text-is("Save estimate")'); pg.wait_for_timeout(600)
    t=pg.inner_text('#view'); ok('prediction apart from actual', 'Your estimate' in t and 'Actual' in t and 'to reach it' in t)
    ok('no errors', not errs); print(errs[:5])
    b.close()
print(sum(res),'/',len(res))
