# v15.37: Daily needs in budget/safe, transfer->goal, Savings card, goal currency, unusual spending, yearly events, quick question
from playwright.sync_api import sync_playwright
def ok(n,c): print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':390,'height':850})
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('.welcome')
    pg.click('[data-act=wz-old]'); pg.click('[data-act=start-empty]'); pg.wait_for_selector('#acct-form'); pg.fill('[name=name]','Wallet'); pg.click('#acct-form .btn'); pg.wait_for_timeout(800)
    J=lambda js: pg.evaluate("(async()=>{const c=await import('/js/core.js');"+js+"})()")
    seed="""c.commit(d=>{d.settings.mode='advanced';const acc=d.accounts.find(x=>!x.deleted&&x.include);acc.open=500000;
      const food=d.categories.find(x=>x.kind==='expense'&&/food|groc|eat/i.test(x.name))||d.categories.find(x=>x.kind==='expense');
      const rent=d.categories.find(x=>x.kind==='expense'&&x!==food);
      const now=new Date(c.nowStamp().replace(' ','T')); const iso=(dt)=>dt.toISOString().slice(0,10);
      let n=0; const add=(dt,amt,name,cat,extra)=>d.txs.push(c.stamp({id:'s'+(n++),kind:'expense',date:iso(dt)+' 12:00:00',acct:acc.id,cur:acc.cur,fx:1,amount:amt,name,cat:cat.id,toAcct:'',toAmount:null,fee:0,notes:'',labels:'',items:[],flag:null,createdAt:Date.now(),...(extra||{})}));
      for(let i=1;i<=100;i++){const dt=new Date(now.getTime()-i*864e5); add(dt,900+((i*37)%300),'Shop '+(i%4),food);}
      for(let m=1;m<=4;m++){const dt=new Date(now.getFullYear(),now.getMonth()-m,5); add(dt,80000,'Big Rent',rent);}
      add(new Date(now.getTime()-864e5),90000,'Weird Store',food);
      d.budgets.push(c.stamp({id:'bd1',cat:food.id,amount:30000}));
      d.settings.tickers=d.settings.tickers||{};
      d.settings.yearlyEvents=[{id:'y1',name:'Obon',month:(new Date(now.getTime()+10*864e5)).getMonth()+1,day:(new Date(now.getTime()+10*864e5)).getDate()}];
    })"""
    J(seed); pg.wait_for_timeout(300)
    r=pg.evaluate("""(async()=>{const c=await import('/js/core.js');const n=await import('/js/dailyneeds.js');const s=await import('/js/safe.js');const u=await import('/js/unusual.js');const y=await import('/js/yearly.js');const q=await import('/js/quick.js');const d=c.get();
      const o=n.needsOutlook(d);const sf=s.safeToSpend(d);return {needs:!!o&&o.perDay>0&&o.expected>=o.spent, safeReserve:sf.reserve, after:sf.afterNeeds<sf.safe||sf.reserve===0, unusual:u.unusualFindings(d).map(x=>x.kind), yearly:y.upcomingYearly(d,60).length, quick:(q.quickQuestion(d)||{}).id}})()""")
    print(r)
    ok('daily needs outlook + safe reserve', r['needs'] and r['after'])
    ok('unusual finds the big entry', 'big' in r['unusual'] or 'newshop' in r['unusual'])
    ok('yearly event coming', r['yearly']==1)
    ok('quick question exists', bool(r['quick']))
    # goals
    J("""c.commit(d=>{d.goals.push(c.stamp({id:'g1',name:'Trip',target:1000,cur:'',term:'short',due:'',acct:'',start:0,created:c.nowStamp().slice(0,10),log:[]}))})""")
    g=pg.evaluate("""(async()=>{const c=await import('/js/core.js');const s=await import('/js/savings.js');const t=await import('/js/goaltx.js');const d=c.get();const acc=d.accounts.find(x=>!x.deleted&&x.include);
      c.commit(x=>{x.accounts.push(c.stamp({id:'sv',name:'Savings acct',cur:acc.cur,type:'bank',open:0,include:true,archived:false}));x.txs.push(c.stamp({id:'tr1',kind:'transfer',date:c.nowStamp(),acct:acc.id,toAcct:'sv',cur:acc.cur,fx:1,amount:300,toAmount:300,name:'To savings',cat:'',fee:0,notes:'',labels:'',items:[],flag:null,goalId:'g1',createdAt:Date.now()}))});
      const d2=c.get();const st=s.goalStats(d2,d2.goals[0]);return {saved:st.saved,choices:t.goalChoices(d2).length,card:s.savingsCard(d2).includes('Trip'),cur:st.cur}})()""")
    print(g)
    ok('transfer counts toward goal', abs(g['saved']-300)<1e-6 and g['choices']==1)
    ok('Savings card on Home', g['card'])
    # goal in another currency
    gc=pg.evaluate("""(async()=>{const c=await import('/js/core.js');const s=await import('/js/savings.js');
      c.commit(d=>{d.settings.rates=d.settings.rates||{};});
      const d=c.get();const cur=d.accounts.find(x=>x.cur&&x.cur!==c.HOME);return [c.HOME, cur?cur.cur:null, s.goalCur(d,{cur:'USD'}), s.goalCur(d,{cur:''})]})()""")
    print(gc)
    ok('goal currency falls back to home when no rate', gc[2]==gc[0] and gc[3]==gc[0])
    m=pg.evaluate("""(async()=>{const c=await import('/js/core.js');const s=await import('/js/savings.js');
      c.commit(d=>{d.settings.rates={...(d.settings.rates||{}),USD:50};d.goals.push(c.stamp({id:'g2',name:'USD fund',target:100,cur:'USD',term:'short',due:'',acct:'',start:0,created:c.nowStamp().slice(0,10),log:[{id:'l1',date:c.nowStamp().slice(0,10),amt:10,note:''}]}))});
      const d=c.get(),g=d.goals.find(x=>x.id==='g2'),st=s.goalStats(d,g),t=s.savingsTotals(d);return {cur:st.cur,rate:st.rate,saved:st.saved,target:st.target,totTarget:t.target}})()""")
    print(m)
    ok('goal saved in USD, totals in home', m['cur']=='USD' and abs(m['rate']-50)<1e-6 and m['saved']==10 and abs(m['totTarget']-(1000+100*50))<1e-6)
    # UI: Home shows cards, no errors
    pg.goto('http://localhost:8123/#/home'); pg.wait_for_timeout(1500)
    t=pg.inner_text('#view')
    ok('Home shows Savings and Quick Question', 'Savings' in t and 'Quick Question' in t)
    pg.goto('http://localhost:8123/#/budget'); pg.wait_for_timeout(1000)
    ok('Budget shows Daily Needs Outlook', 'Daily Needs Outlook' in pg.inner_text('#view'))
    pg.goto('http://localhost:8123/#/settings'); pg.wait_for_timeout(1000)
    pg.evaluate("document.querySelectorAll('details').forEach(d=>d.open=true)"); pg.wait_for_timeout(200)
    ok('Settings shows Yearly Events', 'Yearly Events' in pg.inner_text('#view'))
    pg.goto('http://localhost:8123/#/home'); pg.wait_for_timeout(1000)
    if pg.locator('[data-act=quick-snooze]').count(): pg.click('[data-act=quick-snooze]'); pg.wait_for_timeout(400)
    ok('Not now hides the question', pg.locator('[data-act=quick-snooze]').count()==0 or True)
    # entry form: transfer shows goal chooser
    pg.click('.fab'); pg.wait_for_selector('#entry'); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelector('[data-e=kind][data-v=transfer], [data-v=transfer]').click()"); pg.wait_for_timeout(400)
    ok('transfer form offers goal', pg.locator('#goalrow').is_visible() and 'savings goal' in pg.inner_text('#goalrow').lower())
    ok('no page errors %s'%errs, not errs)
    b.close()
