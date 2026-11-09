# v15.15: editing the date or time of an Earn unsubscribe (or subscribe) re-works the hourly earnings from that moment on
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    H=3600000
    pg.evaluate("""(async()=>{const c=await import('/js/core.js'),e=await import('/js/earn.js');const now=Date.now(),H=3600e3;window.__now=now;
      c.commit(d=>{
        const A=(id,w,open,extra)=>d.accounts.push(c.stamp({id,name:'Zeta '+w,wallet:w,cur:'USDT',type:'crypto',assetType:'crypto',exchange:'Zeta',open,include:false,archived:false,invtab:true,...extra}));
        A('sp','Spot',2000);A('er','Earn',0,{earn:{on:true,apy:8.76,payTo:'spot',lastHour:e.floorHour(now-100*H),trackFrom:now-100*H,lastSlot:now}});
        A('sp2','Spot',500);A('er2','Earn',0,{earn:{on:true,apy:8.76,payTo:'spot',lastHour:e.floorHour(now-100*H),trackFrom:now-100*H,lastSlot:now}});
        const T=(id,from,to,ms,amt)=>d.txs.push(c.stamp({id,kind:'transfer',date:c.nowStamp(new Date(ms)),acct:from,toAcct:to,cur:'USDT',amount:amt,fx:1,name:'Earn move'}));
        T('subA','sp','er',now-72*H+9*60000,1000); T('unsubA','er','sp',now-20*H+30*60000,1000); T('subB','sp2','er2',now-60*H,500);
        e.runEarn(d,now);});})()""")
    EV="""(async(id)=>{const c=await import('/js/core.js'),e=await import('/js/earn.js');const d=c.get(),a=d.accounts.find(x=>x.id===id),log=d.settings.earnLog[id]||{hours:[],days:[]};
      const hrs=[...log.hours.map(x=>[x.h,x.amt]),...log.days.flatMap(x=>x.hours)];const tx=d.txs.filter(t=>!t.deleted&&t.earnAcct===id);
      return {n:hrs.length,sum:Math.round(hrs.reduce((s,x)=>s+x[1],0)*1e8)/1e8,last:Math.max(0,...hrs.map(x=>x[0])),first:Math.min(...hrs.map(x=>x[0])),txSum:Math.round(tx.reduce((s,t)=>s+t.amount,0)*1e8)/1e8,txIds:tx.map(t=>t.id).sort(),dups:new Set(hrs.map(x=>x[0])).size!==hrs.length,due:e.earnDue(d,window.__now)}})"""
    RUN="""(async(f)=>{const c=await import('/js/core.js'),e=await import('/js/earn.js');c.commit(d=>{f(d,c);});})"""
    def ev(id): return pg.evaluate(EV+"('%s')"%id)
    def setdate(tx,delta_h):   # move a transfer by delta hours, then let the app's own check run
        pg.evaluate("""(async()=>{const c=await import('/js/core.js'),e=await import('/js/earn.js');const t=c.get().txs.find(x=>x.id==='%s');const ms=e.localMs(t.date)+(%f)*3600e3;
          c.commit(d=>{const x=d.txs.find(y=>y.id==='%s');x.date=c.nowStamp(new Date(ms));c.stamp(x);window.__due=e.earnDue(d,window.__now);e.runEarn(d,window.__now);});})()"""%(tx,delta_h,tx)); pg.wait_for_timeout(100)
    a0=ev('er'); b0=ev('er2')
    ok('start: about 52 hours of earnings at 0.01 an hour %s'%a0, 50<=a0['n']<=53 and abs(a0['sum']-a0['n']*0.01)<1e-6 and abs(a0['txSum']-a0['sum'])<1e-6 and not a0['dups'])
    ok('earning stops at the unsubscribe time (last hour is within an hour of it)', abs(a0['last']-(pg.evaluate('window.__now')-20*H+30*60000))<=H)
    # later by 5 hours
    setdate('unsubA',5); a1=ev('er')
    ok('unsubscribe 5 hours later: 5 more hours, same total in the entries %s -> %s'%(a0['n'],a1['n']), a1['n']==a0['n']+5 and abs(a1['sum']-a0['sum']-0.05)<1e-6 and abs(a1['txSum']-a1['sum'])<1e-6 and not a1['dups'])
    ok('the app notices the edit by itself (earnDue)', pg.evaluate('window.__due')==True)
    ok('no duplicate daily entries (same or fewer ids)', set(a1['txIds'])>=set(a0['txIds']) and len(a1['txIds'])<=len(a0['txIds'])+1)
    ok('earlier hours stayed exactly as they were', a1['first']==a0['first'])
    # earlier by 15 hours (10 hours before the original)
    setdate('unsubA',-15); a2=ev('er')
    ok('unsubscribe earlier: fewer hours, entries follow %s'%a2['n'], a2['n']==a0['n']-10 and abs(a2['sum']-(a0['sum']-0.10))<1e-6 and abs(a2['txSum']-a2['sum'])<1e-6)
    ok('the other Earn account is untouched', ev('er2')==b0 or {k:v for k,v in ev('er2').items() if k!='due'}=={k:v for k,v in b0.items() if k!='due'})
    # unsubscribe before earning ever started: no earnings at all, entries removed
    setdate('unsubA',-60); a3=ev('er')
    ok('unsubscribed before the first payout: no earnings and no leftover entries %s'%a3, a3['sum']==0 and a3['txSum']==0)
    # delete the unsubscribe: it keeps earning to now
    pg.evaluate("""(async()=>{const c=await import('/js/core.js'),e=await import('/js/earn.js');c.commit(d=>{const x=d.txs.find(y=>y.id==='unsubA');x.deleted=true;c.stamp(x);e.runEarn(d,window.__now);});})()""")
    a4=ev('er'); ok('delete the unsubscribe: earns up to now %s'%a4, a4['n']>=71 and abs(a4['txSum']-a4['sum'])<1e-6 and not a4['dups'])
    # move the subscribe 10 hours later: first hours drop
    setdate('subA',10); a5=ev('er')
    ok('subscribe 10 hours later: 10 fewer hours', a5['n']==a4['n']-10 and abs(a5['txSum']-a5['sum'])<1e-6)
    # the editor offers time for the transfer
    pg.evaluate("(async()=>{const m=await import('/js/entry.js');m.openEntry({id:'unsubA'})})()")
    pg.wait_for_selector('#entry',timeout=5000); pg.wait_for_timeout(300)
    ok('the transfer editor shows the time', ':' in pg.inner_text('#f-when'))
    pg.click('#f-when'); pg.wait_for_selector('#dp-h',timeout=3000)
    ok('and the picker has hour and minute', pg.locator('#dp-h').count()==1)
    ok('no errors %s'%[e for e in errs if 'Tunnel' not in e], not [e for e in errs if 'Tunnel' not in e])
print('fails',res.count(False))
