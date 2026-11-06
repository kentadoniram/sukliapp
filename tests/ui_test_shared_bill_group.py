# v13.48: a shared (Paid for others) bill is ONE bill: opening, editing and deleting any part works on the whole bill
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    J=lambda js: pg.evaluate("(async()=>{const c=await import('/js/core.js');"+js+"})()")
    J("c.commit(d=>{d.settings.mode='advanced';const home=d.settings.homeCur||'PHP';d.accounts.push(c.stamp({id:'w1',name:'Wallet One',cur:home,type:'cash',open:5000,include:true,archived:false}));for(const [i,n] of [['pa','Ana'],['pb','Ben']])d.accounts.push(c.stamp({id:i,name:n,cur:home,type:'owed',open:0,include:true,archived:false}))})")
    pg.evaluate("document.querySelector('[data-act=add]').click()"); pg.wait_for_selector('#entry'); pg.wait_for_timeout(400)
    pg.fill('#f-what','Team Dinner'); pg.evaluate("(()=>{const e=document.querySelector('#f-acct');e.value='w1';e.dispatchEvent(new Event('change',{bubbles:true}))})()"); pg.fill('#f-amount','900'); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelector('[data-e=oth-on]').click()"); pg.wait_for_timeout(300); pg.evaluate("document.querySelector('[data-e=oth-add]').click()"); pg.wait_for_timeout(200)
    pg.locator('.oth-who').nth(0).select_option('pa'); pg.locator('.oth-who').nth(1).select_option('pb'); pg.wait_for_timeout(200)
    pg.evaluate("document.querySelector('#btns [data-e=save]').click()"); pg.wait_for_timeout(1200)
    mem=lambda: J("return c.get().txs.filter(t=>!t.deleted&&t.splitId).map(t=>[t.id,t.kind,t.amount,t.date.slice(0,10),t.acct,t.notes||''])")
    m=mem(); ok('bill saved as 3 linked entries %s'%m, len(m)==3)
    lent=[x for x in m if x[1]=='transfer'][0][0]
    # open one share: read-only view shows the whole bill and group buttons
    J("const s=await import('/js/entryview.js');s.openEntryView('%s')"%lent); pg.wait_for_timeout(400)
    tx=pg.inner_text('.sheet'); ok('a share opens with the whole bill and group buttons', 'Part of a Shared Bill' in tx and 'Edit Whole Bill' in tx and 'Delete Whole Bill' in tx and 'Ana' in tx and 'Ben' in tx)
    pg.evaluate("document.querySelector('[data-ev=edit]').click()"); pg.wait_for_selector('[data-sb=datepick]'); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelector('[data-sb=datepick]').click()"); pg.wait_for_selector('#dp'); pg.evaluate("document.querySelector('#dp [data-m=\"-1\"]').click()"); pg.wait_for_timeout(150); pg.evaluate("document.querySelector('#dp [data-d=\"2026-10-01\"]').click()"); pg.evaluate("document.querySelector('#dp [data-ok]').click()"); pg.wait_for_timeout(300)
    pg.evaluate("(()=>{const e=document.querySelector('[data-sb=notes]');e.value='office';e.dispatchEvent(new Event('change',{bubbles:true}))})()"); pg.wait_for_timeout(200)
    pg.evaluate("document.querySelector('[data-sb=save]').click()"); pg.wait_for_timeout(600)
    m=mem(); ok('date and notes changed on every part %s'%m, all(x[3]=='2026-10-01' and x[5]=='office' for x in m))
    # the old form route also goes to the whole bill
    J("const e=await import('/js/entry.js');e.openEntry({id:'%s'})"%lent); pg.wait_for_selector('[data-sb=save]'); ok('openEntry on a share opens the shared bill window', pg.locator('#entry').count()==0)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    # delete one share -> whole bill goes, one undo brings it back
    J("const s=await import('/js/entryview.js');s.openEntryView('%s')"%lent); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelector('[data-ev=del]').click()"); pg.wait_for_timeout(400)
    pg.evaluate("(()=>{const b=[...document.querySelectorAll('button')].find(x=>/^Delete$/.test(x.textContent.trim())&&!x.hasAttribute('data-ev'));if(b)b.click()})()"); pg.wait_for_timeout(600)
    ok('deleting one share deleted the whole bill', len(mem())==0)
    pg.evaluate("(()=>{const b=[...document.querySelectorAll('.toast button, #toast button')].find(x=>/undo/i.test(x.textContent));if(b)b.click()})()"); pg.wait_for_timeout(600)
    ok('Undo brings all 3 back', len(mem())==3)
    ok('no errors %s'%errs, not errs)
    b.close()
print('fails',res.count(False))
