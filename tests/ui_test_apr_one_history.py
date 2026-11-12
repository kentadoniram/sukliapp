# v15.33: an Earn account has ONE APR history. A rate typed on the account page (Interest Details) and the one in Subscription Settings > APR Changes show the same rates.
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    # the old split: Subscription Settings says 12%, the account page says 12% then 11% from a date
    pg.evaluate("""(async()=>{const c=await import('/js/core.js');c.commit(d=>{
      d.accounts.push(c.stamp({id:'ea',name:'ZzEx Earn USDT',cur:'USDT',type:'crypto',open:100,include:false,archived:false,exchange:'ZzEx',wallet:'Earn',invtab:true,apy:12,rates:[{from:'2026-10-01',rate:11}],earn:{on:false,apy:12,apyHist:[{at:0,apy:12}]}}));})})()""")
    pg.evaluate("(async()=>{const c=await import('/js/core.js'),e=await import('/js/earn.js');c.commitQuiet(d=>{e.syncEarnRates(d)})})()"); pg.wait_for_timeout(500)   # what the app does when it starts
    h=pg.evaluate("window.sukli.get().accounts.find(x=>x.id==='ea').earn.apyHist.map(x=>x.apy)")
    ok('the rate typed on the account page was adopted into the APR history %s'%h, h==[12,11])
    ok('the current rate is now 11', pg.evaluate("window.sukli.get().accounts.find(x=>x.id==='ea').earn.apy")==11)
    pg.evaluate("(async()=>{(await import('/js/ui.js')).ACT['earn-open']({dataset:{id:'ea',focus:'apr'}})})()"); pg.wait_for_selector('#aprhist'); pg.wait_for_timeout(300)
    t=pg.inner_text('#aprhist')
    ok('APR Changes lists both 12% and 11%', '12%' in t and '11%' in t)
    ok('the Current Yearly Rate field shows 11, not 12', pg.input_value('[data-ew=apy]')=='11')
    # add a new rate in Subscription Settings: the account page follows
    pg.fill('[data-ew=apy]','10'); pg.dispatch_event('[data-ew=apy]','change'); pg.wait_for_timeout(500)
    a=pg.evaluate("(()=>{const x=window.sukli.get().accounts.find(q=>q.id==='ea');return [x.earn.apyHist.map(y=>y.apy),x.apy,(x.rates||[]).map(r=>r.rate)]})()")
    ok('a new rate set there is mirrored to the account page data %s'%a, a[0]==[12,11,10] and a[1]==12 and a[2]==[11,10])
    ok('earlier rates are kept (nothing lost)', 12 in a[0] and 11 in a[0])
    pg.evaluate("document.querySelectorAll('.sheet-close,[data-close]').forEach(b=>b.click())"); pg.evaluate("(async()=>{const m=await import('/js/accpage.js');m.openAccountDetail('ea')})()"); pg.wait_for_timeout(900)
    body=pg.inner_text('body')
    ok('Interest Details on the account page lists the same three rates', all(x in body for x in ['12% a year','11% a year','10% a year']))
    ok('no errors %s'%errs, not errs)
print('fails',res.count(False))
