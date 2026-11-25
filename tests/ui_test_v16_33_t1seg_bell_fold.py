# v16.33: Theme 1 sliding switch on Tax/Discount/Fee types; Budget group in the bell folds; Quick Glance at the top
from playwright.sync_api import sync_playwright
res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(service_workers='block',viewport={'width':390,'height':844}).new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached'); pg.set_input_files('#first-file','/home/claude/Transactions.csv'); pg.wait_for_timeout(1500)
    pg.evaluate("document.querySelectorAll('.scrim').forEach(e=>e.remove())")
    # ---- bell
    pg.evaluate("""async()=>{const c=await import('/js/core.js');c.commit(db=>{const cat=db.categories.filter(x=>!x.deleted&&x.kind==='expense').slice(0,3);const a=db.accounts.find(x=>!x.deleted&&['bank','cash','ewallet'].includes(x.type));
      for(const [i,ct] of cat.entries()){db.budgets=db.budgets.filter(x=>x.cat!==ct.id);db.budgets.push({id:'tbb'+i,cat:ct.id,amount:10,off:false});db.txs.push({id:'tbt'+i,kind:'expense',amount:500,cur:a.cur,acct:a.id,cat:ct.id,date:c.nowStamp(),name:'over test'});}});return true}""")
    try: pg.evaluate("localStorage.removeItem('sukli-nf-budget-closed')")
    except Exception: pass
    pg.evaluate("location.hash='#/home'"); pg.wait_for_timeout(800)
    pg.locator('[data-act=notifbell]').first.click(); pg.wait_for_selector('.nfgroup'); pg.wait_for_timeout(300)
    ok('budget group present with header', pg.locator('.nfghead').count()==1 and 'alert' in pg.inner_text('.nfghead'))
    ok('quick glance comes before the budget group', pg.evaluate("(()=>{const g=document.querySelector('.nf-glance'),b=document.querySelector('.nfgroup');return !!(g.compareDocumentPosition(b)&4)})()"))
    n=pg.locator('#nf-budget-body .nf').count(); ok('budget items shown (%d)'%n, n>=1)
    pg.click('.nfghead'); pg.wait_for_timeout(200)
    ok('folds on click', pg.evaluate("document.getElementById('nf-budget-body').hidden")); ok('aria-expanded false', pg.get_attribute('.nfghead','aria-expanded')=='false')
    ok('quick glance visible without scrolling', pg.evaluate("(()=>{const r=document.querySelector('.nf-glance').getBoundingClientRect();return r.bottom<innerHeight})()"))
    pg.evaluate("document.querySelectorAll('.scrim').forEach(e=>e.remove())"); pg.wait_for_timeout(200)
    pg.locator('[data-act=notifbell]').first.click(); pg.wait_for_selector('.nfgroup'); pg.wait_for_timeout(300)
    ok('fold remembered', pg.evaluate("document.getElementById('nf-budget-body').hidden"))
    ok('folding keeps the items (count in header)', 'alert' in pg.inner_text('.nfghead'))
    pg.click('.nfghead'); pg.wait_for_timeout(200); ok('unfolds', not pg.evaluate("document.getElementById('nf-budget-body').hidden"))
    pg.evaluate("document.querySelectorAll('.scrim').forEach(e=>e.remove())")
    # ---- entry sheet segs
    pg.evaluate("""async()=>{const c=await import('/js/core.js');c.commit(db=>{db.accounts.push({id:'t-jpb',name:'Test JPY Bank',cur:'JPY',type:'bank',open:100000,include:true,archived:false});});const m=await import('/js/entry.js');m.openEntry({});return true}""")
    pg.wait_for_selector('#f-amount'); pg.wait_for_timeout(400); pg.fill('#f-amount','1000'); pg.wait_for_timeout(200)
    pg.click('.adjlink'); pg.wait_for_selector('#aj-base'); pg.wait_for_timeout(200)
    ok('sheet tax switch is t1seg', pg.locator('#aj-tseg .t1seg').count()==1 and pg.locator('#aj-dseg .t1seg').count()==1)
    pg.locator('#aj-tseg .t1s-slot').nth(1).click(); pg.wait_for_timeout(200)
    ok('tax mode switches to amount', pg.get_attribute('#aj-tseg .t1seg','data-sel')=='1' and pg.locator('#aj-tseg .t1s-slot.on').inner_text().strip()=='Amount')
    ok('switch fills the row width', pg.evaluate("(()=>{const s=document.querySelector('#aj-tseg .t1seg').getBoundingClientRect(),p=document.getElementById('aj-tseg').getBoundingClientRect();return s.width>p.width*0.9})()"))
    pg.screenshot(path='/tmp/v33_sheet.png')
    pg.evaluate("document.querySelectorAll('.scrim').forEach(e=>e.remove())")
    # ---- split into items
    pg.evaluate("""async()=>{const m=await import('/js/entry.js');m.openEntry({});return true}"""); pg.wait_for_selector('#f-amount'); pg.wait_for_timeout(400)
    pg.evaluate("[...document.querySelectorAll('button')].find(b=>/Split into items/.test(b.textContent)).click()"); pg.wait_for_timeout(500)
    pg.evaluate("document.querySelector('[data-e=\"tax-toggle\"]').click()"); pg.wait_for_timeout(400)
    ok('split tax switch is t1seg', pg.locator('.taxdet .t1seg').count()>=1)
    pg.locator('.taxdet .t1seg .t1s-slot').nth(1).click(); pg.wait_for_timeout(300)
    ok('split tax switch changes mode', pg.locator('.taxdet .t1seg .t1s-slot.on').first.inner_text().strip()=='Amount')
    pg.screenshot(path='/tmp/v33_split.png')
    # ---- legacy keeps .seg
    pg.evaluate("document.querySelectorAll('.scrim').forEach(e=>e.remove())")
    pg.evaluate("""async()=>{const a=await import('/js/appearance.js');a.setLook({design:'legacy'});const m=await import('/js/entry.js');m.openEntry({});return true}"""); pg.wait_for_selector('#f-amount'); pg.wait_for_timeout(400)
    pg.fill('#f-amount','1000'); pg.click('.adjlink'); pg.wait_for_selector('#aj-base'); pg.wait_for_timeout(200)
    ok('legacy keeps plain seg', pg.locator('#aj-tseg .seg').count()==1 and pg.locator('#aj-tseg .t1seg').count()==0)
    ok('no page errors %s'%errs, not errs)
    b.close()
print('\n%d/%d passed'%(sum(res),len(res))); raise SystemExit(0 if all(res) else 1)
