# v13.1: Debts tab
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':390,'height':844},service_workers='block'); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(800)
    pg.goto('http://localhost:8123/#/debts'); pg.wait_for_selector('.debtpage'); pg.wait_for_timeout(300)
    ok('route works, no crash with no debts', 'Debts' in pg.inner_text('.debtpage'))
    pg.evaluate("""(async()=>{const c=await import('/js/core.js');c.commit(d=>{
      d.accounts.forEach(a=>{if(['card','loan'].includes(a.type))a.archived=true});const mk=(id,name,type,extra)=>d.accounts.push(c.stamp(Object.assign({id,name,cur:c.HOME,type,open:0,include:false,archived:false},extra)));
      mk('dc','Test Card','card',{stmtDay:5,dueDay:25,debtInt:{on:false}});
      mk('dl','Test Loan','loan',{dueDay:10,loan:{kind:'personal',principal:30000,rate:12,months:12,monthly:2665.5,fees:0,net:30000,lateFee:3,dueDay:10,start:'2026-09-10'}});
      mk('da','Add-on Loan','loan',{dueDay:15,debtInt:{on:true,rate:2,kind:'addon',principal:10000,start:'2099-01-01'}});
      const base=c.nowStamp().slice(0,10)+' 09:00:00';
      d.txs.push(c.stamp({id:'x1',kind:'expense',amount:40000,cur:c.HOME,fx:1,date:base,name:'card spend',cat:d.categories.find(x=>!x.deleted&&x.kind==='expense').id,acct:'dc'}));
      d.txs.push(c.stamp({id:'x2',kind:'expense',amount:20000,cur:c.HOME,fx:1,date:base,name:'loan owed',cat:d.categories.find(x=>!x.deleted&&x.kind==='expense').id,acct:'dl'}));
      d.txs.push(c.stamp({id:'x3',kind:'expense',amount:9000,cur:c.HOME,fx:1,date:base,name:'addon owed',cat:d.categories.find(x=>!x.deleted&&x.kind==='expense').id,acct:'da'}));
      d.settings.debtBudget=12000;})})()""")
    pg.wait_for_timeout(600); t=pg.inner_text('.debtpage')
    ok('three debts listed', 'Your debts (3)' in t and 'Test Card' in t and 'Test Loan' in t and 'Add-on Loan' in t)
    ok('pay order has three rows', pg.locator('.payorder li').count()==3)
    ok('card has no rate: warning and Not set', 'No interest rate is set for Test Card' in t and 'Not set' in t)
    ok('add-on warning', 'uses add-on interest' in t)
    ok('light shown', pg.locator('.debtlight').count()==1)
    first=pg.inner_text('.payorder li.first b'); ok('first in line is a debt name: '+first, first in ('Test Card','Test Loan','Add-on Loan'))
    pg.click('[data-act=debt-edit][data-id=dc]'); pg.wait_for_selector('.sheet form'); pg.fill('input[name=rate]','42.6'); pg.fill('input[name=min]','2000'); pg.click('.sheet form .btn:not(.ghost)'); pg.wait_for_timeout(700)
    t=pg.inner_text('.debtpage'); ok('rate set, card now first (highest interest)', 'No interest rate is set for Test Card' not in t and pg.inner_text('.payorder li.first b')=='Test Card')
    pg.click('[data-act=debt-mode][data-m=snowball]'); pg.wait_for_timeout(500)
    ok('snowball puts smallest first', pg.inner_text('.payorder li.first b')=='Add-on Loan')
    pg.click('[data-act=debt-budget]'); pg.wait_for_selector('.sheet form'); pg.fill('input[name=v]','1000'); pg.click('.sheet form .btn:not(.ghost)'); pg.wait_for_timeout(600)
    ok('red light when money is short', 'debtlight red' in pg.inner_html('.debtpage') and 'short by' in pg.inner_text('.debtpage'))
    pg.click('[data-act=debt-budget-clear]'); pg.wait_for_selector('.sheet, .dialog, [role=dialog]'); pg.click('[role=dialog] .btn:not(.ghost), .sheet .btn.danger, .sheet .btn:not(.ghost)'); pg.wait_for_timeout(600)
    ok('own figure removed', pg.evaluate("window.sukli.get().settings.debtBudget")==None)
    pg.click('[data-act=debt-edit][data-id=dc]'); pg.wait_for_selector('.sheet form'); pg.click('[data-rm]'); pg.wait_for_timeout(500)
    ok('typed figures removable', pg.evaluate("window.sukli.get().accounts.find(a=>a.id==='dc').dm")==None)
    pg.click('.burger'); pg.wait_for_timeout(300); ok('menu has Debts', 'Debts' in pg.inner_text('.drawer'))
    ok('no errors', not errs); print(errs[:3]); b.close()
print(sum(res),'/',len(res))
