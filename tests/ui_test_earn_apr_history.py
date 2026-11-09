# v15.16: Earn APR history: each rate with its date and time, hours use the rate of their own period, edits recalculate from that moment
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
        A('sp','Spot',2000);A('er','Earn',0,{earn:{on:true,apy:17.52,apyHist:[{at:0,apy:8.76},{at:e.floorHour(now-30*H)+30*60000,apy:17.52}],payTo:'spot',lastHour:e.floorHour(now-100*H),trackFrom:now-100*H,lastSlot:now}});
        d.txs.push(c.stamp({id:'subA',kind:'transfer',date:c.nowStamp(new Date(now-72*H)),acct:'sp',toAcct:'er',cur:'USDT',amount:1000,fx:1,name:'Earn move'}));
        e.runEarn(d,now);});})()""")
    CHK="""(async()=>{const c=await import('/js/core.js'),e=await import('/js/earn.js');const d=c.get(),a=d.accounts.find(x=>x.id==='er'),cf=e.cfgOf(a),log=d.settings.earnLog.er,H=3600e3;
      const hrs=[...log.hours.map(x=>[x.h,x.amt]),...log.days.flatMap(x=>x.hours)].sort((p,q)=>p[0]-q[0]);const hist=e.apyHistOf(cf);
      const want=T=>{let r=hist[0].apy;for(const x of hist)if(x.at<=T-H)r=x.apy;return Math.round(1000*r/100/8760*1e8)/1e8};
      const bad=hrs.filter(([T,amt])=>Math.abs(amt-want(T))>1e-8).length;const tx=d.txs.filter(t=>!t.deleted&&t.earnAcct==='er').reduce((s,t)=>s+t.amount,0);
      return {n:hrs.length,bad,sum:hrs.reduce((s,x)=>s+x[1],0),tx,hist,apy:cf.apy}})()"""
    r0=pg.evaluate(CHK)
    ok('hours use the rate of their own period (none wrong, %d hours) %s'%(r0['n'],r0['bad']), r0['n']>=60 and r0['bad']==0 and abs(r0['tx']-r0['sum'])<1e-6)
    pg.evaluate("(async()=>{const m=await import('/js/earnui.js');m.openEarn('er')})()"); pg.wait_for_selector('#aprhist'); pg.wait_for_timeout(300)
    t=pg.inner_text('#aprhist')
    ok('history lists both rates, durations and what each period earned', '8.76%' in t and '17.52%' in t and 'From the start' in t and 'Earned in this period' in t and t.index('8.76%')<t.index('17.52%'))
    # move the second change 10 hours later through the editor
    at1=r0['hist'][1]['at']
    pg.click('[data-ew=aprEdit][data-v="1"]'); pg.wait_for_selector('#ah-apy'); 
    day,tm=pg.evaluate("(async()=>{const e=await import('/js/earn.js');const x=e.e8(%d+10*3600e3,8);return [x.day,x.hm]})()"%at1)
    pg.fill('#ah-day',day); pg.fill('#ah-time',tm); pg.click('#ah-save'); pg.wait_for_timeout(700)
    r1=pg.evaluate(CHK)
    ok('moved 10 hours later: every hour still uses the rate of its period', r1['bad']==0 and r1['hist'][1]['at']==at1+10*3600000 and abs(r1['tx']-r1['sum'])<1e-6)
    ok('the 10 hours went back to the lower rate: total fell by 10 x 0.01', abs((r0['sum']-r1['sum'])-0.10)<1e-6 and r1['n']==r0['n'])
    # add a new change 5 hours ago
    pg.click('[data-ew=aprAdd]'); pg.wait_for_selector('#ah-apy'); pg.fill('#ah-apy','26.28')
    day,tm=pg.evaluate("(async()=>{const e=await import('/js/earn.js');const x=e.e8(window.__now-5*3600e3,8);return [x.day,x.hm]})()"); pg.fill('#ah-day',day); pg.fill('#ah-time',tm); pg.click('#ah-save'); pg.wait_for_timeout(700)
    r2=pg.evaluate(CHK)
    ok('added change: three rates in order, hours follow, current rate is the latest %s'%r2['hist'], len(r2['hist'])==3 and r2['hist'][0]['at']<=r2['hist'][1]['at']<=r2['hist'][2]['at'] and r2['bad']==0 and r2['apy']==26.28 and r2['sum']>r1['sum'])
    # remove it again
    pg.click('[data-ew=aprDel][data-v="2"]'); pg.wait_for_timeout(700); r3=pg.evaluate(CHK)
    ok('removing it puts the earnings back exactly', len(r3['hist'])==2 and r3['bad']==0 and abs(r3['sum']-r1['sum'])<1e-9 and r3['apy']==17.52)
    # typing a new current rate adds a period from now and keeps the past
    pg.fill('[data-ew=apy]','4'); pg.dispatch_event('[data-ew=apy]','change'); pg.wait_for_timeout(600)
    r4=pg.evaluate(CHK); ok('typing a new current rate keeps old hours as they were', len(r4['hist'])==3 and r4['apy']==4 and r4['bad']==0 and abs(r4['sum']-r1['sum'])<0.02)
    ok('no errors %s'%[e for e in errs if 'Tunnel' not in e], not [e for e in errs if 'Tunnel' not in e])
print('fails',res.count(False))
