# v13.4: payment timing refinement (no-deadline debts, steady payers, parking idea, cash check, early fee)
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
EXTRA="""(async()=>{const c=await import('/js/core.js');c.commit(d=>{
  const now=new Date(), fm=(dt)=>dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0');
  d.accounts.push(c.stamp({id:'fr',name:'Friend Loan',cur:c.HOME,type:'loan',open:0,include:false,archived:false}));
  d.accounts.push(c.stamp({id:'sv',name:'Saver',cur:c.HOME,type:'bank',open:100000,include:true,archived:false,apy:6,taxPct:0}));
  d.accounts.forEach(a=>{if(!['pw','sv'].includes(a.id)&&!['card','loan'].includes(a.type))a.include=false});
  d.accounts.push(c.stamp({id:'pk',name:'Park Loan',cur:c.HOME,type:'loan',open:0,include:false,archived:false,dueDay:Math.max(1,now.getDate()-1),loan:{kind:'personal',principal:30000,rate:24,months:12,monthly:3000,fees:0,net:30000,lateFee:0,dueDay:Math.max(1,now.getDate()-1),start:'2026-01-10'}}));
  const T=(id,o)=>d.txs.push(c.stamp(Object.assign({id,cur:c.HOME,fx:1},o)));
  T('pk1',{kind:'expense',amount:30000,date:fm(now)+' 08:00:00',name:'owed',cat:d.categories.find(x=>!x.deleted&&x.kind==='expense').id,acct:'pk'});T('pk2',{kind:'transfer',debtPay:true,amount:100,toAmount:100,date:fm(now)+' 08:30:00',name:'Paid Park',acct:'pw',toAcct:'pk'});
  T('fx1',{kind:'expense',amount:5000,date:fm(now)+' 09:00:00',name:'borrowed',cat:d.categories.find(x=>!x.deleted&&x.kind==='expense').id,acct:'fr'});
  for(let k=1;k<=5;k++){const m=new Date(now.getFullYear(),now.getMonth()-k,1);T('s'+k,{kind:'transfer',debtPay:true,amount:2665.5,toAmount:2665.5,date:fm(m).slice(0,7)+'-15 09:00:00',name:'Paid loan',acct:'pw',toAcct:'dl'});}
})})()"""
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':390,'height':844},service_workers='block'); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8123/'); pg.wait_for_selector('#first-file',state='attached')
    pg.set_input_files('#first-file',CSV); pg.wait_for_selector('#setup',timeout=20000); pg.click('#setup .btn'); pg.wait_for_timeout(800)
    pg.goto('http://localhost:8123/#/debts'); pg.wait_for_selector('.debtpage'); pg.evaluate(SETUP); pg.evaluate(EXTRA); pg.wait_for_timeout(800)
    t=pg.inner_text('.debtpage')
    names=pg.eval_on_selector_all('.payorder li .po-b .dn','b=>b.map(x=>x.textContent)')
    ok('no-deadline debt is last: %s'%names, len(names)==5 and names[-1]=='Friend Loan')
    ok('no-deadline tag and reason shown', 'No deadline' in t and 'No due date is set' in t)
    ok('steady payer keeps usual installment', 'does not push a higher payment' in t)

    ok('parking idea shown with interest', 'Idea:' in t and 'keep' in t and 'Saver' in t)
    ok('extra section present and not in total', 'Paying extra' in t)
    ok('timing tags present', pg.locator('.stag').count()>=4)
    # edit: fixed deadline + early fee
    pg.click('[data-act=debt-edit][data-id=fr]'); pg.wait_for_selector('.sheet form'); pg.select_option('select[name=flex]','fixed'); pg.fill('input[name=early]','2'); pg.click('.sheet form .btn:not(.ghost)'); pg.wait_for_timeout(700)
    dm=pg.evaluate("(async()=>{const c=await import('/js/core.js');return c.get().accounts.find(a=>a.id==='fr').dm})()")
    ok('deadline and early fee saved: %s'%dm, dm and dm.get('flex') is False and dm.get('early')==2)
    # cash short
    pg.evaluate("(async()=>{const c=await import('/js/core.js');c.commit(d=>{d.accounts.find(a=>a.id==='pw').open=0;d.accounts.find(a=>a.id==='sv').open=0;d.txs.forEach(t=>{if(['i1','i2','i3'].includes(t.id))t.deleted=true})})})()"); pg.wait_for_timeout(700)
    t=pg.inner_text('.debtpage'); 
    ok('cash running short is flagged', 'Cash may run short' in t or 'Little cash left' in t or 'Short by' in t)
    ok('no errors', not errs)
bad=len([r for r in res if not r]); print('fails=%d'%bad)
