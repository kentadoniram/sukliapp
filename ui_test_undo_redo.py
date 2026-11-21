# v13.7: general undo and redo
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
J=lambda pg,js: pg.evaluate("(async()=>{const c=await import('/js/core.js');"+js+"})()")
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':390,'height':844},service_workers='block'); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(1000)
    J(pg,"c.undoClear()")
    ok('nothing to undo at the start', J(pg,"return c.undoInfo().undo")==None)
    J(pg,"c.commit(d=>{d.settings.debtMode='snowball'})"); ok('a settings change is not an undo step', J(pg,"return c.undoInfo().undo")==None)
    n0=J(pg,"return c.get().txs.filter(t=>!t.deleted).length")
    J(pg,"c.commit(d=>{d.txs.push(c.stamp({id:'u1',kind:'expense',amount:123,cur:c.HOME,fx:1,date:c.nowStamp(),name:'undo test',cat:d.categories.find(x=>!x.deleted&&x.kind==='expense').id,acct:d.accounts.find(a=>!a.deleted&&!a.archived&&a.include).id}))})")
    ok('add is one step named Added 1 entry', J(pg,"return c.undoInfo().undo.label")=='Added 1 entry')
    pg.wait_for_timeout(1000)
    J(pg,"c.commit(d=>{const t=d.txs.find(x=>x.id==='u1');t.amount=456;c.stamp(t)})"); ok('edit is a step: Edited 1 entry', J(pg,"return c.undoInfo().undo.label")=='Edited 1 entry')
    pg.wait_for_timeout(1000)
    J(pg,"c.commit(d=>{const t=d.txs.find(x=>x.id==='u1');c.softDelete(t)})"); ok('delete is a step', J(pg,"return c.undoInfo().undo.label")=='Deleted 1 entry')
    ok('steps counted', J(pg,"return c.undoInfo().undo.count")==3)
    J(pg,"c.undoLast()"); ok('undo delete brings it back', J(pg,"const t=c.get().txs.find(x=>x.id==='u1');return !t.deleted&&t.amount===456"))
    J(pg,"c.undoLast()"); ok('undo edit restores the amount', J(pg,"return c.get().txs.find(x=>x.id==='u1').amount")==123)
    J(pg,"c.undoLast()"); ok('undo add moves the entry to the bin (soft delete)', J(pg,"const t=c.get().txs.find(x=>x.id==='u1');return !!t&&t.deleted===true")); ok('entry count back to start', J(pg,"return c.get().txs.filter(t=>!t.deleted).length")==n0)
    ok('undone records get a new updated time (sync carries it)', J(pg,"return Date.now()-c.get().txs.find(x=>x.id==='u1').updatedAt<5000"))
    J(pg,"c.redoLast()"); ok('redo brings the entry back', J(pg,"const t=c.get().txs.find(x=>x.id==='u1');return !t.deleted&&t.amount===123"))
    J(pg,"c.redoLast()"); ok('redo edit', J(pg,"return c.get().txs.find(x=>x.id==='u1').amount")==456)
    J(pg,"c.undoLast()"); J(pg,"c.commit(d=>{d.settings.merchants=['Zed']})"); ok('a new change clears redo', J(pg,"return c.undoInfo().redo")==None)
    # burst merges into one step
    pg.wait_for_timeout(1000); k=J(pg,"return c.undoInfo().undo.count")
    J(pg,"c.commit(d=>{d.txs.find(x=>x.id==='u1').name='a';c.stamp(d.txs.find(x=>x.id==='u1'))});c.commit(d=>{d.txs.find(x=>x.id==='u1').name='b';c.stamp(d.txs.find(x=>x.id==='u1'))})"); ok('two quick commits are one step', J(pg,"return c.undoInfo().undo.count")==k+1)
    # UI: menu and settings
    pg.goto('http://localhost:8123/#/home'); pg.wait_for_timeout(500); pg.click('[data-act=menu]'); pg.wait_for_selector('.drawer'); ok('menu shows Undo with the label', 'Undo: Edited 1 entry' in pg.inner_text('.drawer'))
    pg.click('.drawer [data-act=undo-last]'); pg.wait_for_timeout(600); ok('menu Undo works', J(pg,"return c.get().txs.find(x=>x.id==='u1').name")=='undo test' or J(pg,"return c.get().txs.find(x=>x.id==='u1').name")!='b')
    pg.goto('http://localhost:8123/#/settings'); pg.wait_for_selector('#undo-set',state='attached'); pg.evaluate("document.querySelectorAll('details.sgroup').forEach(d=>d.open=true)"); t=pg.inner_text('#undo-set'); ok('Settings has an Undo box with steps', 'Last change' in t and 'available' in t)
    ok('no errors', not errs)
print('fails=%d'%len([r for r in res if not r]))
