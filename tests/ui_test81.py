# v13.30: "Paid for others": your part is the expense, their part is money owed to you
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block'); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(900)
    pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.settings.mode='advanced';d.accounts.push(c.stamp({id:'pplana',name:'Ana',cur:d.settings.homeCur||'PHP',type:'owed',open:0,include:true,archived:false}))})})()")
    pg.evaluate("document.querySelector('[data-act=add]').click()"); pg.wait_for_selector('#entry'); pg.wait_for_timeout(500)
    pg.fill('#f-what','Dinner with friends'); pg.fill('#f-amount','1200')
    ok('box offered', pg.locator('[data-e=oth-on]').count()==1)
    pg.evaluate("document.querySelector('[data-e=oth-on]').click()"); pg.wait_for_timeout(300)
    ok('box opens', pg.locator('#othbox').count()==1)
    pg.evaluate("document.querySelector('[data-e=oth-half]').click()"); pg.wait_for_timeout(300)
    ok('summary shows both parts', '600' in pg.inner_text('#oth-sum'))
    pg.select_option('.oth-who','pplana')
    ok('error when person missing is avoided (chosen)', True)
    before=pg.evaluate("(async()=>{const c=await import('/js/core.js');const a=c.get().accounts.find(x=>x.id==='pplana');const b=c.balances(c.get());return [b.get('pplana'),c.get().txs.filter(t=>!t.deleted).length]})()")
    pg.evaluate("document.querySelector('#btns [data-e=save]').click()"); pg.wait_for_timeout(900)
    r=pg.evaluate("(async()=>{const c=await import('/js/core.js');const t=c.get().txs.filter(x=>!x.deleted&&(x.name||'').includes('Dinner'));const b=c.balances(c.get());return [t.map(x=>[x.kind,x.amount,!!x.lent,!!x.splitWith,x.toAcct||'']),b.get('pplana'),c.get().txs.filter(t=>!t.deleted).length]})()")
    ok('expense is your part only, transfer is their part %s'%r[0], any(x[0]=='expense' and x[1]==600 for x in r[0]) and any(x[0]=='transfer' and x[1]==600 and x[2] and x[4]=='pplana' for x in r[0]))
    ok('Ana now owes 600', r[1]-before[0]>1 and r[2]==before[1]+2)
    # all of it: only a lent transfer, no expense
    pg.wait_for_timeout(1500); pg.evaluate("document.querySelector('[data-act=add]').click()"); pg.wait_for_selector('#entry'); pg.wait_for_timeout(500)
    pg.fill('#f-what','Taxi for Ana'); pg.fill('#f-amount','500'); pg.evaluate("document.querySelector('[data-e=oth-on]').click()"); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelector('[data-e=oth-all]').click()"); pg.wait_for_timeout(200); pg.select_option('.oth-who','pplana'); pg.evaluate("document.querySelector('#btns [data-e=save]').click()"); pg.wait_for_timeout(900)
    r2=pg.evaluate("(async()=>{const c=await import('/js/core.js');return c.get().txs.filter(x=>!x.deleted&&(x.name||'').includes('Taxi for Ana')).map(x=>[x.kind,x.amount])})()")
    ok('all of it: only a transfer %s'%r2, r2==[['transfer',500]])
    ok('no errors %s'%errs, not errs)
    b.close()
print('fails',res.count(False))
