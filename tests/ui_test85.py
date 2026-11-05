# v13.33: Earn schedule in UTC+8, "All" precision, 2-decimal Entries list. Browser timezone is set far from UTC+8 on purpose.
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block',timezone_id='America/Los_Angeles'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.settings.mode='advanced';const mk=(id,w,o)=>d.accounts.push(c.stamp({id,name:'Zed '+w+' USDC',wallet:w,cur:'USDC',type:'crypto',assetType:'crypto',exchange:'Zed',open:o,include:false,archived:false,invtab:true}));mk('zs','Spot',1211);mk('ze','Earn',0);mk('qs','Spot',500);d.accounts[d.accounts.length-1].exchange='Q';mk('qe','Earn',0);d.accounts[d.accounts.length-1].exchange='Q'})})()")
    # 2 All = 1211 exactly, even with a guessed fee
    pg.evaluate("(async()=>{const m=await import('/js/entry.js');m.openEntry({preset:{kind:'transfer',acct:'zs',toAcct:'ze'}})})()"); pg.wait_for_selector('#f-amount'); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelector('[data-e=allamt]').click()"); pg.wait_for_timeout(300)
    v=pg.input_value('#f-amount'); ok('All fills 1211 (%s)'%v, v.replace(',','')=='1211')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    # 3 list vs detail
    pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.txs.push(c.stamp({id:'tt1',kind:'expense',date:c.nowStamp(),acct:'zs',cur:'USDC',amount:1210.996,fx:1,name:'Decimal test'}))});c.ui&&0})()")
    pg.evaluate("(async()=>{const m=await import('/js/app.js')}).catch&&0") if False else None
    html=pg.evaluate("(async()=>{const s=await import('/js/screens.js');const c=await import('/js/core.js');const t=c.get().txs.find(x=>x.id==='tt1');return s.row(t,c.accountMap(c.get()),c.catMap(c.get()),false,null)})()")
    print(html[html.find('class="amt'):][:200]) if False else print(html[-400:])
    ok('list shows 1,210.99 (cut)', '1,210.99' in html and '1,210.996' not in html)
    pg.evaluate("(async()=>{const m=await import('/js/entry.js');m.openEntry({id:'tt1'})})()"); pg.wait_for_selector('#f-amount'); pg.wait_for_timeout(300)
    v=pg.input_value('#f-amount'); ok('detail keeps 1210.996 (%s)'%v, v.replace(',','')=='1210.996')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    # 1 Earn
    r=pg.evaluate("""(async()=>{const e=await import('/js/earn.js');const c=await import('/js/core.js');
      const sub=Date.UTC(2026,10,1,7,9), now=e.e8Ms('2026-11-03','15:00');
      c.commit(d=>{const a=d.accounts.find(x=>x.id==='ze');a.earn={on:true,apy:8.76,lastHour:e.floorHour(sub),trackFrom:sub,lastSlot:now};
        d.txs.push(c.stamp({id:'es1',kind:'transfer',date:c.nowStamp(new Date(sub)),acct:'zs',toAcct:'ze',cur:'USDC',amount:1000,fx:1,name:'Sub',earnSubAt:sub}));
        const m=e.runEarn(d,now); window.__m=m;});
      const d=c.get(),log=d.settings.earnLog.ze,a=d.accounts.find(x=>x.id==='ze'),subs=e.subscriptions(d,a);
      return {m:window.__m,days:log.days.map(x=>[x.day,x.amt,x.hours.length]).reverse(),pend:log.hours.map(x=>e.e8Label(x.h)),first:e.e8Label(subs[0].first),start:e.e8Label(subs[0].start),sub:e.e8Label(subs[0].sub),txs:d.txs.filter(t=>t.earnDay).length}})()""")
    print(r)
    ok('subscription 15:09, earning from 16:00, first payout 17:00 (UTC+8)', r['sub']=='2026-11-01 15:09' and r['start']=='2026-11-01 16:00' and r['first']=='2026-11-01 17:00')
    ok('day 1 has 8 hours (17:00 to 00:00) = 0.08', r['days'][0]==['2026-11-01',0.08,8])
    ok('day 2 full 24 hours = 0.24', r['days'][1]==['2026-11-02',0.24,24])
    ok('today still hourly, 15 hours, today has one open entry', len(r['pend'])==15 and r['pend'][0]=='2026-11-03 01:00' and r['txs']==3)
    # auto subscription at 03:00 and 15:00 UTC+8
    r=pg.evaluate("""(async()=>{const e=await import('/js/earn.js');const c=await import('/js/core.js');
      const l=e.e8Ms('2026-11-03','00:00'), now=e.e8Ms('2026-11-03','15:30');
      c.commit(d=>{const a=d.accounts.find(x=>x.id==='qe');a.earn={on:true,apy:0,subOn:true,slots:['03:00','15:00'],subAmt:'all',from:'qs',lastHour:e.floorHour(now),lastSlot:l};e.runEarn(d,now)});
      const d=c.get();return d.txs.filter(t=>t.earnAuto&&t.acct==='qs').map(t=>[e.e8Label(t.earnSubAt),t.amount])})()""")
    ok('auto subscribe used the 03:00 slot time and moved all 500 %s'%r, r==[['2026-11-03 03:00',500]])
    # UI opens
    pg.evaluate("(async()=>{const m=await import('/js/earnui.js');m.openEarn('ze')})()"); pg.wait_for_selector('#ew'); pg.wait_for_timeout(300)
    t=pg.inner_text('#ew'); ok('window mentions UTC+8 and daily history', 'UTC+8' in t and 'Daily History' in t and '2026-11-02' in t)
    pg.click('#ew [data-ew=day][data-v="2026-11-02"]'); pg.wait_for_timeout(200)
    ok('day expands to hourly rows', pg.locator('#ew .cardbox li').count()==24)
    ok('no errors %s'%errs, not errs)
    b.close()
print('fails',res.count(False))
