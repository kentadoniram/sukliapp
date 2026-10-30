# v13.12: undo history kept across restarts, history page under the Recycle bin
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
J=lambda pg,code: pg.evaluate("(async()=>{const c=await import('/js/core.js');"+code+"})()")
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(1000)
    J(pg,"c.undoClear()"); pg.wait_for_timeout(300)
    J(pg,"c.commit(d=>{d.accounts.push(c.stamp({id:'h1',name:'Hist One',cur:c.HOME,type:'cash',open:100,include:true,archived:false}))})"); pg.wait_for_timeout(1000)
    J(pg,"c.commit(d=>{d.accounts.push(c.stamp({id:'h2',name:'Hist Two',cur:c.HOME,type:'cash',open:200,include:true,archived:false}))})"); pg.wait_for_timeout(1000)
    J(pg,"c.commit(d=>{d.accounts.find(a=>a.id==='h1').name='Hist Uno';c.stamp(d.accounts.find(a=>a.id==='h1'))})"); pg.wait_for_timeout(2500)
    n=pg.evaluate("(async()=>{const c=await import('/js/core.js');return c.undoHistory().undo.length})()"); ok('three steps recorded: %s'%n, n==3)
    pg.reload(); pg.wait_for_selector('.tabs',timeout=20000); pg.wait_for_timeout(1500)
    n=pg.evaluate("(async()=>{const c=await import('/js/core.js');return c.undoHistory().undo.length})()"); ok('history survives a restart: %s'%n, n==3)
    pg.goto('http://localhost:8123/#/home'); pg.wait_for_timeout(400); pg.click('[data-act=menu]'); pg.wait_for_selector('.drawer'); ok('menu has Undo history', 'Undo history' in pg.inner_text('.drawer'))
    pg.click('.drawer a[href="#/bin?v=history"]'); pg.wait_for_timeout(600); t=pg.inner_text('#view')
    ok('history page lists steps', 'Undo history' in t and t.count('Undo to here')==3 and 'Changed 1 account' in t)
    ok('two cards: Deleted and Undo history', pg.locator('.bintabs a').count()==2)
    pg.click('.bintabs a:has-text("Deleted")'); pg.wait_for_timeout(400); ok('Deleted card shows the bin', 'Keep deleted items for' in pg.inner_text('#view'))
    pg.goto('http://localhost:8123/#/bin?v=history'); pg.wait_for_timeout(500)
    pg.click('[data-act=hist-to][data-n="2"]'); pg.wait_for_timeout(600)
    st=J(pg,"const d=c.get();return [!!d.accounts.find(a=>a.id==='h1'&&!a.deleted), !!d.accounts.find(a=>a.id==='h2'&&!a.deleted)]") or pg.evaluate("(async()=>{const c=await import('/js/core.js');const d=c.get();return [!!d.accounts.find(a=>a.id==='h1'&&!a.deleted),!!d.accounts.find(a=>a.id==='h2'&&!a.deleted)]})()")
    ok('undo to here removed Hist Two but kept Hist One: %s'%st, st==[True,False])
    ok('redo offered', 'Redo:' in pg.inner_text('#view'))
    pg.click('[data-act=hist-clear]'); pg.wait_for_selector('[data-yes]'); pg.click('[data-yes]'); pg.wait_for_timeout(500); ok('clear history empties list', 'No changes to undo yet' in pg.inner_text('#view'))
    # changed elsewhere => history dropped on restart
    J(pg,"c.commit(d=>{d.accounts.push(c.stamp({id:'h3',name:'Hist Three',cur:c.HOME,type:'cash',open:1,include:true,archived:false}))})"); pg.wait_for_timeout(2500)
    J(pg,"const o=await (async()=>{return null})();c.commitQuiet&&c.commitQuiet(d=>{d.accounts.find(a=>a.id==='h3').name='Edited quietly';c.stamp(d.accounts.find(a=>a.id==='h3'))});await c.flush()"); pg.reload(); pg.wait_for_selector('.tabs',timeout=20000); pg.wait_for_timeout(1500)
    n=pg.evaluate("(async()=>{const c=await import('/js/core.js');return c.undoHistory().undo.length})()"); ok('history dropped when data changed outside it: %s'%n, n==0)
    ok('no errors %s'%errs, not errs)
print('fails',res.count(False))
