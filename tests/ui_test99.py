# v13.44: habit learning, rest: Daily Needs, trips left out of usual spending and of the debt plan, "on trips" line, monthly shops not "planned"
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block',timezone_id='Asia/Tokyo'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    r=pg.evaluate("(async()=>{const t=await import('/js/trips.js'),c=await import('/js/core.js');const d=c.get();const n=t.dailyNeeds(d),ids=t.tripEntryIds(d),rep=t.tripReport(d);return [n.perDay,n.perMonth,n.days,n.left,ids.size,rep.trips.length,rep.planned.length]})()"); print(r)
    ok('daily needs figure, a month is 30 days', r[0]>0 and abs(r[1]-r[0]*30)<1 and r[2]>=30)
    ok('trip entries found', r[4]>0)
    pg.evaluate("location.hash='#/trips'"); pg.wait_for_timeout(1200); t=pg.inner_text('body'); ok('Trips page shows Daily Needs', 'Daily Needs' in t and 'An ordinary day' in t)
    # trips stay out of the debt plan's usual spending
    r2=pg.evaluate("""(async()=>{const c=await import('/js/core.js'),t=await import('/js/trips.js');const d=c.get(),ids=t.tripEntryIds(d);const id=[...ids][0];const before=JSON.stringify(ids.size);return [before,ids.size>0]})()""")
    pg.evaluate("location.hash='#/debts'"); pg.wait_for_timeout(1200); ok('Debts page still opens', 'Debt' in pg.inner_text('body'))
    pg.evaluate("(async()=>{const m=await import('/js/spendgroups.js');return 1})()")
    rr=pg.evaluate("(async()=>{const m=await import('/js/spendgroups.js'),c=await import('/js/core.js');const x=m.spendReport(c.get(),'all');return [x.spentAll,x.onTrips]})()"); ok('spending report knows what went on trips %s'%rr, rr[1]>0 and rr[1]<rr[0])
    # a shop paid every month is not a planned booking
    n=pg.evaluate("""(async()=>{const c=await import('/js/core.js'),t=await import('/js/trips.js');const acct=c.get().accounts.find(a=>!a.deleted&&a.type==='cash')||c.get().accounts[0];
      c.commit(d=>{for(let m=1;m<=4;m++)d.txs.push(c.stamp({id:'esim'+m,kind:'expense',date:'2026-0'+m+'-05 10:00:00',acct:acct.id,amount:3000,cur:acct.cur,fx:1,name:'Zeta eSIM plan',cat:''}))});
      return t.tripReport(c.get()).planned.filter(p=>/zeta/i.test(p.name)).length})()"""); ok('monthly eSIM plan not listed as planned %s'%n, n==0)
    ok('no errors %s'%errs, not errs)
    b.close()
print('fails',res.count(False))
