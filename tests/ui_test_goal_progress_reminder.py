# v15.16: savings goal reminder judges real progress (saved, recent contributions, usual leftover, other goals), not just a schedule
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    # a clean world: one account in the home currency, 3 finished months with income 300000 and spending 200000 (so 100000 is usually left)
    pg.evaluate("""(async()=>{const c=await import('/js/core.js');
      c.commit(d=>{
        d.txs=[];d.goals=[];d.budgets=[];
        const inc=d.categories.find(x=>!x.deleted&&x.kind==='income'),exp=d.categories.find(x=>!x.deleted&&x.kind==='expense');
        d.accounts.push(c.stamp({id:'gk',name:'Goal Check Bank',cur:c.HOME,type:'bank',open:0,include:true,archived:false}));
        const ym=c.thisMonth();
        for(let i=1;i<=3;i++){const m=c.shiftMonth(ym,-i);
          d.txs.push(c.stamp({id:'inc'+i,kind:'income',date:m+'-15 12:00:00',acct:'gk',cur:c.HOME,amount:300000,fx:1,cat:inc.id,name:'Pay'}));
          d.txs.push(c.stamp({id:'exp'+i,kind:'expense',date:m+'-16 12:00:00',acct:'gk',cur:c.HOME,amount:200000,fx:1,cat:exp.id,name:'Living'}));}
      });})()""")
    JS="""(async(spec)=>{const c=await import('/js/core.js'),g=await import('/js/goalcheck.js');
      const iso=n=>{const d=new Date();d.setDate(d.getDate()+n);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
      const goal={id:'t',name:'Test goal',target:spec.target,due:iso(spec.due),created:iso(-spec.age),term:'short',log:(spec.log||[]).map((x,i)=>({id:'l'+i,amt:x[1],date:iso(-x[0])})),start:0};
      const others=(spec.others||[]).map(x=>({...x,due:iso(x.due)}));const db={...c.get(),goals:[goal,...others]};const o=g.goalOutlook(db,goal,iso(0));return {level:o.level,lines:o.lines,needed:o.needed,actual:o.actual,leftover:o.leftover}})"""
    def lv(spec): return pg.evaluate(JS+"(%s)"%__import__('json').dumps(spec))
    A=lv({'target':120000,'due':100,'age':100,'log':[[90,30000],[70,30000],[50,30000]]})
    ok('missed the last contributions but real progress is enough: on track (no warning) %s'%A['level'], A['level']=='ontrack')
    B=lv({'target':1500000,'due':300,'age':60,'log':[[58,50000],[28,50000]]})
    ok('followed the plan every month but it is not enough: not on track (risk) %s'%B['lines'], B['level']=='risk' and B['needed']>B['leftover'])
    C=lv({'target':600000,'due':200,'age':60,'log':[[55,20000]]})
    ok('little saved but your usual leftover can cover it: behind, can catch up %s'%C['lines'], C['level']=='behind')
    D=lv({'target':60000,'due':300,'age':5,'log':[]})
    ok('a new goal is not judged by actual saving yet (early)', D['level']=='early' and D['actual'] is None)
    E=lv({'target':60000,'due':-3,'age':100,'log':[[50,1000]]})
    ok('target date passed: late', E['level']=='late')
    F=lv({'target':10000,'due':50,'age':100,'log':[[30,10000]]})
    ok('already reached: nothing to say', F['level']=='reached')
    G=lv({'target':1500000,'due':300,'age':60,'log':[[58,50000],[28,50000]],'others':[{'id':'o','name':'Other','target':900000,'due':150,'created':'2000-01-01','log':[],'start':0}]})
    ok('other goals use up the leftover, so this one is harder to reach (leftover %s lower)'%G['leftover'], G['leftover']<B['leftover'])
    # screen: banner on Home with Not now, and the card on Savings
    pg.evaluate("""(async()=>{const c=await import('/js/core.js');const iso=n=>{const d=new Date();d.setDate(d.getDate()+n);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
      c.commit(d=>{d.goals.push(c.stamp({id:'g1',name:'New Laptop',target:600000,due:iso(200),created:iso(-60),term:'short',start:0,log:[{id:'l0',amt:20000,date:iso(-55)}]}));});})()""")
    pg.goto('http://localhost:8123/#/'); pg.wait_for_timeout(700)
    ok('Home shows the goal reminder', pg.locator('section[aria-label="Savings goal reminders"]').count()==1 and 'New Laptop' in pg.inner_text('section[aria-label="Savings goal reminders"]'))
    pg.goto('http://localhost:8123/#/savings'); pg.wait_for_timeout(600)
    ok('the goal card explains it with plan and actual', 'catch up' in pg.inner_text('.goalcheck') and 'Plan:' in pg.inner_text('.goalcheck') and 'Actually saved' in pg.inner_text('.goalcheck'))
    pg.goto('http://localhost:8123/#/'); pg.wait_for_timeout(500); pg.click('section[aria-label="Savings goal reminders"] [data-act=goal-snooze]'); pg.wait_for_timeout(400)
    ok('Not now hides it for a while', pg.locator('section[aria-label="Savings goal reminders"]').count()==0)
    ok('no errors %s'%[e for e in errs if 'Tunnel' not in e], not [e for e in errs if 'Tunnel' not in e])
print('fails',res.count(False))
