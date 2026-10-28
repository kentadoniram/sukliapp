# v13.1-13.3: Debts tab (plan with cash flow, due dates, habits, shortfall)
import re
from playwright.sync_api import sync_playwright
CSV='/home/claude/Transactions.csv'; res=[]
def ok(n,c): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n)
SETUP="""(async()=>{const c=await import('/js/core.js');c.commit(d=>{
  d.txs.forEach(t=>{t.deleted=true});
  d.accounts.forEach(a=>{if(['card','loan'].includes(a.type))a.archived=true});
  const now=new Date(), fm=(dt)=>dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0');
  const soon=new Date(now);soon.setDate(Math.min(now.getDate()+2,28));const later=new Date(now);later.setDate(Math.min(now.getDate()+12,28));
  const ex=d.categories.filter(x=>!x.deleted&&x.kind==='expense'), inc=d.categories.find(x=>!x.deleted&&x.kind==='income');
  const mk=(id,name,type,extra)=>d.accounts.push(c.stamp(Object.assign({id,name,cur:c.HOME,type,open:0,include:false,archived:false},extra)));
  mk('pw','Wallet','bank',{open:200000,include:true});
  mk('dc','Test Card','card',{stmtDay:1,dueDay:later.getDate(),debtInt:{on:false}});
  mk('dl','Test Loan','loan',{dueDay:soon.getDate(),loan:{kind:'personal',principal:30000,rate:12,months:12,monthly:2665.5,fees:0,net:30000,lateFee:3,dueDay:soon.getDate(),start:'2026-01-10'}});
  mk('da','Add-on Loan','loan',{dueDay:later.getDate(),debtInt:{on:true,rate:2,kind:'addon',principal:10000,start:'2099-01-01'}});
  const T=(id,o)=>d.txs.push(c.stamp(Object.assign({id,cur:c.HOME,fx:1},o)));
  for(let k=1;k<=3;k++){const m=new Date(now.getFullYear(),now.getMonth()-k,1), ym=fm(m).slice(0,7);
    T('i'+k,{kind:'income',amount:50000,date:ym+'-25 09:00:00',name:'Pay',cat:inc.id,acct:'pw'});
    T('e'+k,{kind:'expense',amount:20000,date:ym+'-05 09:00:00',name:'Rent stuff',cat:ex[0].id,acct:'pw'});
    T('f'+k,{kind:'expense',amount:10000,date:ym+'-12 09:00:00',name:'Fun stuff',cat:ex[1].id,acct:'pw'});
    T('p'+k,{kind:'transfer',debtPay:true,amount:6000,toAmount:6000,date:ym+'-20 09:00:00',name:'Paid Test Card',acct:'pw',toAcct:'dc'});}
  const base=fm(now)+' 09:00:00';
  T('x1',{kind:'expense',amount:40000,date:base,name:'card spend',cat:ex[0].id,acct:'dc'});
  T('x2',{kind:'expense',amount:20000,date:base,name:'loan owed',cat:ex[0].id,acct:'dl'});
  T('x3',{kind:'expense',amount:9000,date:base,name:'addon owed',cat:ex[0].id,acct:'da'});
  delete d.settings.debtBudget; delete d.settings.debtForce;})})()"""
def total_pct(pg):
    m=re.search(r'Total ₱[\d,\.]+ \((\d+)% of your income\)', pg.inner_text('.debtpage')); return int(m.group(1)) if m else None
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':390,'height':844},service_workers='block'); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(800)
    pg.goto('http://localhost:8123/#/debts'); pg.wait_for_selector('.debtpage'); pg.wait_for_timeout(200)
    pg.evaluate(SETUP); pg.wait_for_timeout(700); t=pg.inner_text('.debtpage')
    ok('three debts listed', 'Your debts (3)' in t and 'Test Card' in t and 'Test Loan' in t and 'Add-on Loan' in t)
    ok('month card shows income, usual spending and what is left', 'Income you usually get' in t and '₱50,000.00' in t and 'Your usual spending' in t and '₱30,000.00' in t and 'Left after your usual spending' in t)
    pc=total_pct(pg); ok('suggested total is 30%% of income, cushion kept (%s)'%pc, pc==30 and 'Kept as a safety cushion' in t)
    names=pg.eval_on_selector_all('.payorder li .po-b > b','b=>b.map(x=>x.textContent)'); ok('pay order has three rows, nearest due first: %s'%names, len(names)==3 and names[0]=='Test Loan')
    ok('due date shown with a warning about late payment', 'Paying late can add interest or fees' in t)
    card=pg.locator('.payorder li', has_text='Test Card').inner_text(); ok('card follows your habit (usually pays about 6,000)', 'You usually pay about ₱6,000.00' in card and '3 of the last 6 months' in card)
    amts=[float(re.search(r'Pay ₱([\d,\.]+)',pg.locator('.payorder li').nth(i).inner_text()).group(1).replace(',','')) for i in range(3)]; ok('amounts differ per debt %s'%amts, len(set(amts))==3)
    ok('card warning for missing rate', 'No interest rate is set for Test Card' in t); ok('add-on warning', 'uses add-on interest' in t)
    ok('light shown', pg.locator('.debtlight').count()==1)
    # typed figure too high is cut, can be forced and undone
    pg.click('[data-act=debt-budget]'); pg.wait_for_selector('.sheet form'); pg.fill('input[name=v]','50000'); pg.click('.sheet form .btn:not(.ghost)'); pg.wait_for_timeout(700); t=pg.inner_text('.debtpage')
    ok('typed 50,000 is cut with a clear note', 'Use my figure anyway' in t and 'Suggests at most 40%' in t.replace('Sukli s','S') or ('Use my figure anyway' in t and 'at most 40%' in t)); pc=total_pct(pg); ok('plan still within 40%% (%s)'%pc, pc is not None and pc<=40)
    pg.click('[data-act=debt-force]'); pg.wait_for_timeout(600); t=pg.inner_text('.debtpage'); pc2=total_pct(pg); ok('forced figure is used and flagged (%s)'%pc2, 'Go back to the safe amount' in t and pc2 is not None and pc2>40)
    pg.click('[data-act=debt-unforce]'); pg.wait_for_timeout(600); ok('back to safe amount', 'Use my figure anyway' in pg.inner_text('.debtpage'))
    # shortfall
    pg.click('[data-act=debt-budget]'); pg.wait_for_selector('.sheet form'); pg.fill('input[name=v]','2000'); pg.click('.sheet form .btn:not(.ghost)'); pg.wait_for_timeout(700); t=pg.inner_text('.debtpage')
    ok('shortfall flagged with amount', 'Short by' in t and 'debtlight red' in pg.inner_html('.debtpage'))
    ok('lists which debts are left short', pg.locator('.shortlist li').count()>=1)
    ok('ways to find the money', 'Ways to find' in t and 'Ask the lender' in t)
    tot=float(re.search(r'Total ₱([\d,\.]+)', pg.inner_text('.debtpage')).group(1).replace(',','')); ok('nothing suggested above the money available (%s)'%tot, tot<=2000.01)
    names=pg.eval_on_selector_all('.payorder li .po-b > b','b=>b.map(x=>x.textContent)'); ok('nearest due still first when short', names[0]=='Test Loan')
    # mode toggle moves only the extra
    pg.click('[data-act=debt-budget-clear]'); pg.wait_for_selector('[role=dialog], .sheet'); pg.click('[role=dialog] .btn:not(.ghost), .sheet .btn:not(.ghost)'); pg.wait_for_timeout(600)
    ok('own figure removed', pg.evaluate("window.sukli.get().settings.debtBudget")==None)
    pg.click('[data-act=debt-mode][data-m=snowball]'); pg.wait_for_timeout(500); ok('mode switch works', 'on' in (pg.get_attribute('[data-act=debt-mode][data-m=snowball]','class') or ''))
    # edit figures
    pg.click('[data-act=debt-edit][data-id=dc]'); pg.wait_for_selector('.sheet form'); pg.fill('input[name=rate]','42.6'); pg.fill('input[name=min]','2000'); pg.click('.sheet form .btn:not(.ghost)'); pg.wait_for_timeout(700)
    ok('rate set', 'No interest rate is set for Test Card' not in pg.inner_text('.debtpage'))
    pg.click('[data-act=debt-edit][data-id=dc]'); pg.wait_for_selector('.sheet form'); pg.click('[data-rm]'); pg.wait_for_timeout(500)
    ok('typed figures removable', pg.evaluate("window.sukli.get().accounts.find(a=>a.id==='dc').dm")==None)
    pg.click('.burger'); pg.wait_for_timeout(300); ok('menu has Debts', 'Debts' in pg.inner_text('.drawer'))
    ok('no errors', not errs); print(errs[:3]); b.close()
print(sum(res),'/',len(res))
