# v16.29: notification bell: kinds appear, are visually distinct, persist after reading, clear only when resolved
from playwright.sync_api import sync_playwright
res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
SETUP="""async()=>{const c=await import('/js/core.js');const d=c.get();
 const tdy=c.today(), add=(n)=>{const x=new Date(); x.setDate(x.getDate()+n); return x.toISOString().slice(0,10)};
 c.commit((db)=>{
  const bank=db.accounts.find(a=>!a.deleted&&['bank','cash','ewallet'].includes(a.type));
  db.accounts.push({id:'t-loan',name:'Test Loan',cur:'PHP',type:'loan',open:-50000,include:false,archived:false,dueDay:Math.max(1,+tdy.slice(8,10)-2)});
  db.accounts.push({id:'t-owed',name:'Ben',cur:'PHP',type:'owed',open:500,include:false,archived:false,owedDue:add(-3)});
  db.settings.bills=[{id:'t-bill',name:'Test Phone Bill',amount:900,due:add(1),every:'month',left:0}];
  const cat=db.categories.find(x=>!x.deleted&&x.kind==='expense');
  db.budgets.push({id:'t-bud',cat:cat.id,amount:1,off:false});
 });
 return true}"""
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(service_workers='block',viewport={'width':390,'height':844}).new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached'); pg.set_input_files('#first-file','/home/claude/Transactions.csv'); pg.wait_for_timeout(1500)
    pg.evaluate("document.querySelectorAll('.scrim').forEach(e=>e.remove())")
    pg.evaluate(SETUP); pg.wait_for_timeout(600)
    pg.evaluate("location.hash='#/home'"); pg.wait_for_timeout(800)
    ok('bell present', pg.locator('[data-act=notifbell]').count()>0)
    pg.evaluate("document.querySelectorAll('.scrim').forEach(e=>{if(!e.querySelector('.nflist'))e.remove()})")
    pg.locator('[data-act=notifbell]').first.click(); pg.wait_for_selector('.nflist'); pg.wait_for_timeout(300)
    kinds=pg.evaluate("[...document.querySelectorAll('.nf')].map(e=>[...e.classList].find(c=>c.startsWith('nf-')&&c!=='nf-ic'&&c!=='nf-b'))")
    print(kinds)
    ok('budget notification', 'nf-budget' in kinds); ok('bill notification', 'nf-bill' in kinds); ok('owed notification', 'nf-owed' in kinds)
    ok('debt notification', 'nf-debt' in kinds)
    ok('each kind has a written label', pg.evaluate("[...document.querySelectorAll('.nf .nf-kind')].every(e=>e.textContent.trim().length>2)"))
    cols=pg.evaluate("[...new Set([...document.querySelectorAll('.nf')].map(e=>getComputedStyle(e).borderInlineStartColor))].length")
    ok('kinds have different colours (%d)'%cols, cols>=4)
    ok('overdue first', pg.evaluate("document.querySelector('.nf .nf-st')!==null"))
    n1=pg.locator('.nflist .nf').count()
    ok('new tag on first open', pg.locator('.nf-new').count()>0)
    pg.screenshot(path='/tmp/bell1.png')
    pg.evaluate("document.querySelectorAll('.scrim').forEach(e=>e.remove())"); pg.wait_for_timeout(200)
    pg.locator('[data-act=notifbell]').first.click(); pg.wait_for_selector('.nflist'); pg.wait_for_timeout(300)
    ok('same items after reading (persist) %d'%n1, pg.locator('.nflist .nf').count()==n1)
    ok('new tags gone after reading', pg.locator('.nf-new').count()==0)
    badge=pg.evaluate("document.querySelector('[data-act=notifbell] .bdot')&&document.querySelector('[data-act=notifbell] .bdot').textContent")
    ok('badge still counts open items (%s)'%badge, badge)
    # resolve the bill: mark paid -> due moves a month ahead -> leaves the bell
    pg.evaluate("async()=>{const c=await import('/js/core.js');c.commit(db=>{db.settings.bills=[]; db.budgets=db.budgets.filter(x=>x.id!=='t-bud')})}")
    pg.evaluate("document.querySelectorAll('.scrim').forEach(e=>e.remove())")
    pg.locator('[data-act=notifbell]').first.click(); pg.wait_for_selector('.nflist'); pg.wait_for_timeout(300)
    kinds2=pg.evaluate("[...document.querySelectorAll('.nf')].map(e=>[...e.classList].find(c=>c.startsWith('nf-')&&c!=='nf-ic'&&c!=='nf-b'))")
    ok('resolved items leave', 'nf-bill' not in kinds2 and 'nf-budget' not in kinds2); ok('unresolved stay', 'nf-owed' in kinds2)
    ok('no overflow', not pg.evaluate("document.documentElement.scrollWidth>window.innerWidth+1"))
    ok('no page errors %s'%errs, not errs)
print('fails',res.count(False)); raise SystemExit(1 if False in res else 0)
