# v12au: remove or change the "how much did you pay" figure on the Performance card
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':390,'height':844},service_workers='block'); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(800)
    pg.evaluate("""(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.settings.tickers=d.settings.tickers||{};d.settings.tickers.ZQX={ticker:'ZQX',name:'Zed',assetType:'stock',quote:'USD',price:5,priceDate:'2026-10-27',history:[{date:'2026-10-27',ts:4,price:5,quote:'USD',src:'manual'}]};
      d.accounts.push(c.stamp({id:'zq',name:'ZQX',baseName:'ZQX',type:'invest',invtab:true,cur:'ZQX',open:10,include:true,exchange:'Moomoo',assetType:'stock',costHome:999999}))})})()""")
    pg.goto('http://localhost:8123/#/invest'); pg.wait_for_selector('.nwcard'); pg.wait_for_timeout(900)
    t=pg.inner_text('#view'); ok('shows the entered figure with Change and Remove', 'your figure' in t and pg.locator('[data-act=inv-cost-clear]').count()==1)
    pg.click('[data-act=inv-cost-clear]'); pg.wait_for_selector('[data-yes]'); pg.click('[data-yes]'); pg.wait_for_timeout(600)
    ok('figure removed from the account', pg.evaluate("window.sukli.get().accounts.find(a=>a.id==='zq').costHome===undefined"))
    ok('ZQX now listed as no known cost with I paid…', 'No known cost' in pg.inner_text('#view') and pg.locator('[data-act=inv-cost][data-id=zq]').count()==1)
    pg.click('[data-act=inv-cost][data-id=zq]'); pg.wait_for_selector('.sheet input'); pg.fill('.sheet input','500'); pg.keyboard.press('Enter'); pg.wait_for_timeout(600)
    ok('new figure saved', pg.evaluate("window.sukli.get().accounts.find(a=>a.id==='zq').costHome")==500)
    ok('no errors', not errs); print(errs[:3]); b.close()
print(sum(res),'/',len(res))
