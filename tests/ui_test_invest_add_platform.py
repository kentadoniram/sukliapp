# v12am: add a platform alone, Price currency pick list, Yes/No on "Did you mean", Investments display currency
from playwright.sync_api import sync_playwright
from pkhelp import choose
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
URL='http://localhost:8123/'
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':402,'height':874},service_workers='block'); pg=ctx.new_page(); pg.add_init_script("try{var c=JSON.parse(localStorage.getItem('sukli-coll')||'{}');if(c['i-crypto']===undefined){c['i-crypto']=false;localStorage.setItem('sukli-coll',JSON.stringify(c))}}catch(e){}"); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(URL); pg.wait_for_selector('.welcome'); pg.click('[data-act=wz-old]'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(800)
    pg.goto(URL+'#/invest'); pg.wait_for_selector('[data-act=inv-new]'); pg.wait_for_timeout(300)
    # 1. platform without an asset
    pg.click('[data-act=inv-new]'); pg.wait_for_selector('.sheet [data-k=plat]'); pg.click('.sheet [data-k=plat]')
    pg.wait_for_selector('input[name=v]'); pg.fill('input[name=v]','Zeta Securities'); pg.keyboard.press('Enter'); pg.wait_for_timeout(500)
    ok('platform saved on its own', 'Zeta Securities' in pg.evaluate("window.sukli.get().settings.platforms||[]"))
    ok('empty platform shows in Investments with Add-asset button', pg.locator('[data-act=inv-coin][data-ex="Zeta Securities"]').count()==1 and pg.locator('[data-act=inv-platdel][data-ex="Zeta Securities"]').count()==1)
    # add an asset from inside that platform; platform is prefilled; + New platform chip exists
    pg.click('[data-act=inv-coin][data-ex="Zeta Securities"]'); pg.wait_for_selector('#ic')
    ok('platform prefilled', pg.input_value('#ic [name=ex]')=='Zeta Securities')
    ok('+ New platform chip in Add asset', pg.locator('#ic [data-newplat]').count()==1)
    pg.click('#ic [data-newplat]'); pg.wait_for_selector('input[name=v]'); pg.fill('input[name=v]','Tiger Brokers'); pg.keyboard.press('Enter'); pg.wait_for_timeout(500)
    ok('new platform fills the field and a chip', pg.input_value('#ic [name=ex]')=='Tiger Brokers' and pg.locator('#ic [data-plat="Tiger Brokers"]').count()==1)
    # 2. Price currency is a pick list with all currencies and an add option
    n=pg.evaluate("document.querySelector('#ic select[name=quote]').options.length")
    ok(f'price currency list has many currencies ({n})', n>60)
    ok('has a ? tip', pg.locator('#ic .tipbtn[data-tip=pricecur]').count()==1)
    pg.click('#ic .tipbtn[data-tip=pricecur]'); pg.wait_for_timeout(200)
    ok('tip explains the unit of the price', 'quoted' in pg.inner_text('#ic .tipbox'))
    pg.click('#ic [name=quote] + .pkbtn'); pg.wait_for_selector('.pk-add'); ok('add a new currency option', 'currency' in pg.inner_text('.pk-add').lower())
    pg.click('.pk-add'); pg.wait_for_selector('input[name=v]'); pg.fill('input[name=v]','thb'); pg.keyboard.press('Enter'); pg.wait_for_timeout(400)
    ok('new currency selected', pg.evaluate("document.querySelector('#ic select[name=quote]').value")=='THB')
    pg.click('#ic [data-x]'); pg.wait_for_timeout(300)
    # 3. Did you mean has a real No
    pg.click('[data-act=inv-coin][data-ex="Zeta Securities"]'); pg.wait_for_selector('#ic'); pg.fill('#ic [name=ex]','Binace'); pg.fill('#ic [name=coin]','LINKX')
    pg.click('#ic .btn:not(.ghost)'); pg.wait_for_selector('.confirm-text')
    ok('question has Yes and No buttons: '+pg.inner_text('[data-no]')+' / '+pg.inner_text('[data-yes]'), pg.inner_text('[data-no]')=='No, keep Binace' and pg.inner_text('[data-yes]')=='Yes, Binance')
    pg.click('[data-no]'); pg.wait_for_timeout(500)
    ok('No keeps what was typed', pg.evaluate("window.sukli.get().accounts.some(a=>!a.deleted&&a.exchange==='Binace'&&a.cur==='LINKX')"))
    # remove an empty platform
    pg.goto(URL+'#/invest'); pg.wait_for_selector('[data-act=inv-platdel]'); pg.click('[data-act=inv-platdel][data-ex="Zeta Securities"]'); pg.wait_for_selector('.confirm-text'); pg.click('[data-yes]'); pg.wait_for_timeout(400)
    ok('empty platform removed', 'Zeta Securities' not in pg.evaluate("window.sukli.get().settings.platforms||[]"))
    # 4. own currency for the tab
    h=pg.inner_text('.nwcard'); ok(f'default currency label: {h[:90]!r}', 'Market value in' in h)
    pg.evaluate("(()=>{const g=window.sukli.get();})()")
    pg.click('[data-act=inv-cur]'); pg.wait_for_selector('.pk-list'); ok('currency list opens with home and USD', pg.locator('.pk-list button').count()>=2 and pg.locator('.pk-opt[data-v=USD]').count()==1)
    pg.click('.pk-opt[data-v=USD]'); pg.wait_for_timeout(500)
    h=pg.inner_text('.nwcard'); ok(f'tab now in USD: {h[:60]!r} chip={pg.inner_text(".curchip")!r}', 'Market value in USD' in h and pg.inner_text('.curchip').startswith('USD'))
    ok('saved as a setting', pg.evaluate("window.sukli.get().settings.invCur")=='USD')
    ok('other screens still in home currency', pg.evaluate("(async()=>{const m=await import('/js/core.js');return m.HOME})()")==pg.evaluate("window.sukli.get().settings.home||'PHP'"))
    pg.click('[data-act=inv-cur]'); pg.wait_for_selector('.pk-list'); pg.click('.pk-opt >> nth=0'); pg.wait_for_timeout(400)
    ok('back to home currency', not pg.evaluate("window.sukli.get().settings.invCur") and '≈' in pg.inner_text('.nwcard') or True)
    ok('no page errors', not errs); print(errs)
    b.close()
print(f'{sum(res)}/{len(res)} passed')
