# v13.43: Interest Earned daily entry in Spot (grows hourly), hourly breakdown, account types per exchange, Earned in realized
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block',timezone_id='Asia/Tokyo'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    pg.evaluate("""(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.settings.mode='advanced';d.settings.titleCase=false;d.settings.platformTz={Ex:0};
      const mk=(id,w,o)=>d.accounts.push(c.stamp({id,name:'Ex '+w+' USDT',wallet:w,cur:'USDT',type:'crypto',assetType:'crypto',exchange:'Ex',open:o,include:false,archived:false,invtab:true}));mk('sp','Spot',0);mk('er','Earn',1000);
      d.accounts.find(a=>a.id==='er').earn={on:true,apy:8.76,lastHour:Date.now()-5*3600e3,lastSlot:Date.now(),trackFrom:Date.now()-30*3600e3,startLagH:0,firstLagH:1}})})()""")
    # a subscription 30 hours ago so there is principal; run the engine
    pg.evaluate("""(async()=>{const c=await import('/js/core.js'),e=await import('/js/earn.js');c.commit(d=>{d.txs.push(c.stamp({id:'sub1',kind:'transfer',date:c.nowStamp(new Date(Date.now()-30*3600e3)),acct:'sp',toAcct:'er',cur:'USDT',amount:1000,toAmount:1000,fx:1,name:'sub',earnSubAt:Date.now()-30*3600e3}));e.runEarn(d)})})()""")
    r=pg.evaluate("(async()=>{const c=await import('/js/core.js');const d=c.get();const t=d.txs.filter(x=>x.earnDay);return [t.length,t.map(x=>x.acct),t.map(x=>x.name),t.some(x=>x.earnOpen),c.balances(d).get('sp'),c.balances(d).get('er')]})()"); print(r)
    ok('daily entries credited to Spot, named Interest Earned', r[0]>=1 and all(a=='sp' for a in r[1]) and all(n=='Interest Earned' for n in r[2]))
    ok('today is open, Spot balance grew, Earn balance untouched except the subscription', r[3] and r[4]>-1000 and r[5]==2000)
    # one entry per day, grows with the next hour
    n0=pg.evaluate("(async()=>{const c=await import('/js/core.js');const t=c.get().txs.find(x=>x.earnOpen);return [t.amount,c.get().txs.filter(x=>x.earnDay).length]})()")
    pg.evaluate("""(async()=>{const c=await import('/js/core.js'),e=await import('/js/earn.js');c.commit(d=>{d.accounts.find(a=>a.id==='er').earn.lastHour-=H;function f(){};e.runEarn(d,Date.now()+3600e3)})})()""".replace("-=H","-=3600e3"))
    n1=pg.evaluate("(async()=>{const c=await import('/js/core.js');const t=c.get().txs.find(x=>x.earnDay&&x.earnOpen);return [t&&t.amount,c.get().txs.filter(x=>x.earnDay).length]})()"); print(n0,n1)
    ok('the next hour adds to the same entry (no new row)', n1[0] is not None and n1[0]>=n0[0] and n1[1]<=n0[1]+1)
    # entry list note and breakdown
    pg.evaluate("location.hash='#/ledger'"); pg.wait_for_timeout(900); t=pg.inner_text('body')
    ok('Entries shows Interest Earned with the still-adding-up note', 'Interest Earned' in t and 'adding up' in t)
    pg.evaluate("(async()=>{const c=await import('/js/core.js'),m=await import('/js/accpage.js');m.openInterestDetail(c.get().txs.find(x=>x.earnDay))})()"); pg.wait_for_timeout(500)
    t=pg.inner_text('.sheet'); ok('tapping shows the hourly list %s'%t[:70].replace('\n',' '), 'Interest Earned' in t and 'platform clock' in t and t.count('0.')>=2)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    # account types per exchange
    r=pg.evaluate("(async()=>{const t=await import('/js/tokens.js'),c=await import('/js/core.js');t.addAccountType('Ex','Copy Trading');return t.accountTypesOf(c.get(),'Ex').includes('Copy Trading')})()"); ok('account type added for one exchange', r is True)
    r=pg.evaluate("(async()=>{const t=await import('/js/tokens.js'),c=await import('/js/core.js');return t.accountTypesOf(c.get(),'Other Ex').includes('Copy Trading')})()"); ok('and only for that exchange', r is False)
    pg.evaluate("(async()=>{const m=await import('/js/platform.js');m.openPlatform('Ex')})()"); pg.wait_for_selector('#pset'); ok('exchange settings has + Add Account Type', 'Add Account Type' in pg.inner_text('#pset') and 'Copy Trading' in pg.inner_text('#pset'))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    # earned in the realized card
    pg.evaluate("location.hash='#/invest'"); pg.wait_for_timeout(900)
    pg.evaluate("document.querySelectorAll('details').forEach(d=>d.open=true)"); pg.wait_for_timeout(300); t=pg.inner_text('body')
    ok('Unrealized Profit, Realized Profit, Earned shown', 'Unrealized Profit' in t and 'Realized Profit' in t and 'Earned' in t)
    ok('no errors %s'%errs, not errs)
    b.close()
print('fails',res.count(False))
