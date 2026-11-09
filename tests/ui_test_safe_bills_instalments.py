# v15.17: Safe to Spend: bills and instalments list, card counting mode (all owed / due within 30 days)
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    R=pg.evaluate("""(async()=>{const c=await import('/js/core.js'),s=await import('/js/safe.js');
      const day=(n)=>new Date(Date.now()+n*864e5).toISOString().slice(0,10);
      c.commit(d=>{d.settings.bills=[]});
      const base=s.safeToSpend(c.get()).safe;
      c.commit(d=>{d.settings.bills=[{id:'b1',name:'Phone',amount:5000,due:day(5),every:'once',left:0},{id:'b2',name:'Laptop',amount:10000,due:day(2),every:'month',left:3},{id:'b3',name:'Far',amount:7000,due:day(60),every:'once',left:0}]});
      const r=s.safeToSpend(c.get()); const names=r.items.map(x=>x.name);
      return {base,safe:r.safe,names,d:s.billDues({due:'2026-01-31',every:'month',left:3,amount:1},'2026-01-30',120),m:s.addMonth('2026-01-31')}})()""")
    ok('bills due in 30 days are taken off (5000 + 10000 now; the second laptop payment is 30+ days away or not) %s'%R, 'Phone' in R['names'] and 'Laptop' in R['names'] and 'Far' not in R['names'] and 14999<R['base']-R['safe']<=25000.01)
    ok('instalment with 3 left stops after 3 payments', len(R['d'])==3)
    ok('month end handled (31 Jan + 1 month = 28 Feb)', R['m']=='2026-02-28')
    pg.evaluate("(async()=>{const s=await import('/js/safe.js');window.__s=s;})()"); pg.wait_for_timeout(200)
    pg.evaluate("document.querySelector('[data-act=safe-info]')?.click() || document.dispatchEvent(new Event('x'))")
    pg.evaluate("(async()=>{const u=await import('/js/ui.js');u.ACT['safe-info']()})()"); pg.wait_for_selector('.calfacts',timeout=3000)
    t=pg.inner_text('.sheet')
    ok('sheet shows cards setting and the Bills button', 'Credit cards count' in t and 'Bills and Instalments' in t)
    pg.click('[data-act=safe-cards][data-v=due]'); pg.wait_for_timeout(300)
    ok('card mode saved', pg.evaluate("(async()=>(await import('/js/core.js')).get().settings.safeCards)()")=='due')
    pg.evaluate("(async()=>{(await import('/js/ui.js')).ACT['bills-open']()})()"); pg.wait_for_selector('.billlist',timeout=3000)
    ok('list shows the three bills', pg.locator('.billlist li').count()==3)
    pg.click('.billlist li:has-text("Phone") [data-act=bill-paid]'); pg.wait_for_selector('.billlist'); pg.wait_for_timeout(200)
    ok('paid one-time bill disappears', pg.locator('.billlist li').count()==2)
    pg.click('.billlist li:has-text("Laptop") [data-act=bill-paid]'); pg.wait_for_selector('.billlist'); pg.wait_for_timeout(200)
    L=pg.evaluate("(async()=>(await import('/js/core.js')).get().settings.bills.find(b=>b.id==='b2'))()")
    ok('paid instalment moves a month and has 2 left %s'%L, L['left']==2)
    pg.click('[data-act=bill-edit][data-v=""]'); pg.wait_for_selector('#bl-save')
    pg.fill('#bl-name','Gym'); pg.fill('#bl-amt','3000'); pg.click('[data-bl-every=month]'); pg.fill('#bl-left','4'); pg.click('#bl-save'); pg.wait_for_selector('.billlist'); pg.wait_for_timeout(200)
    G=pg.evaluate("(async()=>(await import('/js/core.js')).get().settings.bills.find(b=>b.name==='Gym'))()")
    ok('added monthly bill %s'%G, G and G['every']=='month' and G['left']==4 and G['amount']==3000)
    pg.once('dialog',lambda d:d.accept())
    pg.click('.billlist li:has-text("Gym") [data-act=bill-del]'); pg.wait_for_timeout(400)
    if pg.locator('.confirm button.danger, .dlg button.danger, button.btn.danger').count(): pg.locator('button.btn.danger').last.click(); pg.wait_for_timeout(300)
    ok('removed', pg.evaluate("(async()=>!(await import('/js/core.js')).get().settings.bills.some(b=>b.name==='Gym'))()"))
    ok('no errors %s'%errs, not errs)
print('fails',res.count(False))
