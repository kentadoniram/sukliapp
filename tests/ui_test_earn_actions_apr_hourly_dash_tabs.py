# v15.22: Investments dashboard cards as one row of tabs; Earn account actions on one row; APR change by date + exact time, mid-hour change never pays the part-hour at the new rate
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    pg.evaluate("""(async()=>{const c=await import('/js/core.js'),e=await import('/js/earn.js');const now=Date.now(),H=3600e3;window.__now=now;
      c.commit(d=>{
        const A=(id,w,open,extra)=>d.accounts.push(c.stamp({id,name:'Zeta '+w,wallet:w,cur:'USDT',type:'crypto',assetType:'crypto',exchange:'Zeta',open,include:false,archived:false,invtab:true,...extra}));
        A('sp','Spot',2000);A('er','Earn',0,{earn:{on:true,apy:8.76,apyHist:[{at:0,apy:8.76}],payTo:'spot',lastHour:e.floorHour(now-100*H),trackFrom:now-100*H,lastSlot:now}});
        d.txs.push(c.stamp({id:'subA',kind:'transfer',date:c.nowStamp(new Date(now-72*H)),acct:'sp',toAcct:'er',cur:'USDT',amount:1000,fx:1,name:'Earn move'}));
        e.runEarn(d,now);});})()""")
    # 1. dashboard tabs
    pg.goto('http://localhost:8123/#/invest'); pg.wait_for_selector('.dashcard'); pg.wait_for_timeout(500)
    sw=pg.locator('.dashcard .swb').all_inner_texts()
    ok('v15.28: ONE card with a switch per section %s'%sw, pg.locator('.dashcard').count()==1 and 'Per-Token Performance' in sw and 'Fees and Losses' in sw and 'Prediction' in sw and 'Realized Gains' in sw)
    ys=pg.evaluate("[...document.querySelectorAll('.dashcard .swb')].map(e=>e.getAttribute('role')+':'+e.getAttribute('aria-checked'))")
    ok('they are real switches and only the first section is on at first %s'%ys, ys[0]=='switch:true' and all(y=='switch:false' for y in ys[1:]))
    ok('only the switched-on section is shown', pg.locator('.dashcard .dashbody').count()==1)
    pg.click('.dashcard .swb:has-text("Fees and Losses")'); pg.wait_for_timeout(400)
    print('DBG',pg.locator('.dashcard .dashbody').count(),'Trading fees' in pg.inner_text('.dashcard'),pg.locator('.dashcard .dashbody .coll').count())
    ok('switching Fees and Losses on adds it below (both shown, each collapsible)', pg.locator('.dashcard .dashbody').count()==2 and 'Trading fees' in pg.inner_text('.dashcard') and pg.locator('.dashcard .dashbody .coll').count()>=2)
    pg.reload(); pg.wait_for_selector('.dashcard'); pg.wait_for_timeout(400)
    ok('choice remembered', pg.locator('.dashcard .swb.on').count()==2 and 'Fees and Losses' in pg.inner_text('.dashcard .swb.on >> nth=1'))
    pg.click('.dashcard .swb:has-text("Fees and Losses")'); pg.wait_for_timeout(300); pg.click('.dashcard .swb.on'); pg.wait_for_timeout(300)
    ok('all off shows a hint instead of an empty card', 'Turn a section on' in pg.inner_text('.dashcard'))
    # 2. Earn account: one row of actions
    pg.evaluate("(async()=>{const u=await import('/js/ui.js');u.ACT.acct({dataset:{id:'er'}})})()"); pg.wait_for_selector('[data-ad=edit]'); pg.wait_for_timeout(300)
    ys=pg.evaluate("['[data-ad=edit]','[data-act=earn-open]:not([data-focus])','[data-act=earn-open][data-focus=apr]','[data-act=earn-toggle]'].map(s=>{const e=document.querySelector(s);const r=(e.closest('label')||e).getBoundingClientRect();return Math.round(r.top+r.height/2)})")
    ok('Edit, Subscription Settings, APR Changes and the switch share one row %s'%ys, max(ys)-min(ys)<=6)
    # 3. mid-hour APR change
    pg.click('[data-act=earn-open][data-focus=apr]'); pg.wait_for_selector('#aprhist'); pg.wait_for_timeout(400)
    pg.click('[data-ew=aprAdd]'); pg.wait_for_selector('#ah-when')
    at=pg.evaluate("(async()=>{const e=await import('/js/earn.js'),H=3600e3;const f=e.floorHour(Date.now()-5*H)+30*60000;const x=e.e8(f,8);window.__at=f;return [x.day,x.hm]})()")
    pg.fill('#ah-apy','17.52'); pg.evaluate("([d,t])=>document.querySelector('#ah-when').setWhen(d+' '+t)",at)
    t=pg.inner_text('#ah-calc')
    ok('sheet explains the mid-hour rule %s'%t[:160], 'middle of an hour' in t and 'first full hour' in t and '8.76%' in t)
    pg.click('#ah-save'); pg.wait_for_timeout(800)
    R=pg.evaluate("""(async()=>{const c=await import('/js/core.js'),e=await import('/js/earn.js'),H=3600e3;const d=c.get(),a=d.accounts.find(x=>x.id==='er'),log=d.settings.earnLog.er;
      const hrs=Object.fromEntries([...log.hours.map(x=>[x.h,x.amt]),...log.days.flatMap(x=>x.hours)]);const f=e.floorHour(window.__at);
      return {hist:e.apyHistOf(e.cfgOf(a)),straddle:hrs[f+H],before:hrs[f],firstNew:hrs[f+2*H],at:window.__at,f}})()""")
    lo=round(1000*8.76/100/8760,8); hi=round(1000*17.52/100/8760,8)
    ok('the change is stored with its exact time %s'%R['hist'], len(R['hist'])==2 and R['hist'][1]['at']==R['at'])
    ok('hour in progress at the change keeps the old rate (%s)'%R['straddle'], abs(R['straddle']-lo)<1e-8 and abs(R['before']-lo)<1e-8)
    ok('first full hour after the change pays the new rate (%s)'%R['firstNew'], abs(R['firstNew']-hi)<1e-8)
    # exactly on the hour counts from that hour
    pg.click('[data-ew=aprEdit][data-v="1"]'); pg.wait_for_selector('#ah-when')
    pg.evaluate("([d,t])=>document.querySelector('#ah-when').setWhen(d+' '+t)",[pg.evaluate("(async()=>{const e=await import('/js/earn.js');return e.e8(%d,8).day})()"%R['f']),pg.evaluate("(async()=>{const e=await import('/js/earn.js');return e.e8(%d,8).hm})()"%R['f'])])
    ok('on-the-hour text', 'exactly on the hour' in pg.inner_text('#ah-calc')); pg.click('#ah-save'); pg.wait_for_timeout(800)
    R2=pg.evaluate("""(async()=>{const c=await import('/js/core.js'),e=await import('/js/earn.js'),H=3600e3;const log=c.get().settings.earnLog.er;const hrs=Object.fromEntries([...log.hours.map(x=>[x.h,x.amt]),...log.days.flatMap(x=>x.hours)]);const f=e.floorHour(window.__at);return {a:hrs[f+H]}})()""")
    ok('rate set on the hour pays that hour at the new rate (%s)'%R2['a'], abs(R2['a']-hi)<1e-8)
    pg.keyboard.press('Escape')
    # 4. account form for Earn: hourly note instead of the daily rate-change list
    pg.evaluate("(async()=>{const u=await import('/js/ui.js');u.ACT.acct({dataset:{id:'er'}})})()"); pg.wait_for_selector('[data-ad=edit]')
    pg.evaluate("document.querySelectorAll('.toast').forEach(e=>e.remove());[...document.querySelectorAll('[data-ad=edit]')].pop().click()"); pg.wait_for_selector('#aprnote',state='attached'); pg.wait_for_timeout(300)
    ok('Earn form: hourly note shown, daily rate-change list hidden', pg.evaluate("(()=>{const n=document.querySelector('#aprnote'),r=document.querySelector('#ratefld');return !n.hidden&&r.hidden})()"))
    ok('no errors %s'%errs, not errs)
print('fails',res.count(False))
