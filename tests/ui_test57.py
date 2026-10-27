# v12at: delete a wrong saved price, currency chip in header row
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':390,'height':844},service_workers='block'); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(800)
    pg.evaluate("""(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.settings.tickers=d.settings.tickers||{};d.settings.tickers.ZQX={ticker:'ZQX',name:'Zed',assetType:'stock',quote:'USD',price:5000,priceDate:'2026-10-27',history:[
      {date:'2026-10-01',ts:1,price:50,quote:'USD',src:'manual'},{date:'2026-10-10',ts:2,price:52,quote:'USD',src:'manual'},{date:'2026-10-20',ts:3,price:55,quote:'USD',src:'manual'},{date:'2026-10-27',ts:4,price:5000,quote:'USD',src:'manual'}]};
      d.accounts.push(c.stamp({id:'zq',name:'ZQX',baseName:'ZQX',type:'invest',invtab:true,cur:'ZQX',open:10,include:true,exchange:'Moomoo',assetType:'stock'}))})})()""")
    pg.goto('http://localhost:8123/#/invest'); pg.wait_for_selector('.nwcard'); pg.wait_for_timeout(900)
    ok('currency chip on the header row', pg.evaluate("(()=>{const c=document.querySelector('.curchip'),r=document.querySelector('[data-act=inv-add]');return !!c&&Math.abs(c.getBoundingClientRect().top-r.getBoundingClientRect().top)<8})()"))
    ok('old Show Investments in row gone', 'Show Investments in' not in pg.inner_text('.nwcard'))
    ok('warning for the odd price', pg.locator('.warnline').count()==1)
    pg.click('.warnline [data-act=inv-ticker]'); pg.wait_for_selector('[data-hdel]'); ok('odd record flagged', pg.locator('li.oddp').count()==1)
    pg.click('li.oddp [data-hdel]'); pg.wait_for_selector('[data-yes]'); pg.click('[data-yes]'); pg.wait_for_timeout(700)
    r=pg.evaluate("(()=>{const t=window.sukli.get().settings.tickers.ZQX;return [t.price,t.history.length]})()")
    ok('price falls back to the one before %s'%r, r==[55,3])
    ok('no more warning', pg.locator('li.oddp').count()==0)
    ok('no errors', not errs); print(errs[:3]); b.close()
print(sum(res),'/',len(res))
